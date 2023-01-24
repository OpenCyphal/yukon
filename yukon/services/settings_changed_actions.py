import asyncio
import json
import logging
import os
import sys
import threading
import traceback
import typing

import uavcan

from pycyphal.dsdl import install_import_hook
from pycyphal.dsdl._import_hook import DsdlMetaFinder

import yukon
from yukon.domain.reactive_value_objects import ReactiveValue
from yukon.domain.request_run_dronecan import RequestRunDronecan
from yukon.domain.start_fileserver_request import StartFileServerRequest
from yukon.domain.udp_connection import UDPConnection
from yukon.services.CentralizedAllocator import CentralizedAllocator
from yukon.services.FileServer import FileServer
from yukon.services.enhanced_json_encoder import EnhancedJSONEncoder
from yukon.services.mydronecan.file_server import SimpleFileServer
from yukon.services.udp_server import UDPConnectionServer
from yukon.services.utils import add_path_to_sys_path

logger = logging.getLogger(__name__)


def set_udp_server_handlers(state: "yukon.domain.god_state.GodState") -> None:
    setting = state.settings.get("UDP subscription output")
    if not setting:
        logger.error("No setting for UDP subscription output")
        return
    setting_enabled = setting["Enabled"]
    connection_object = UDPConnection(
        ip=state.settings["UDP subscription output"]["IP address"].value,
        port=state.settings["UDP subscription output"]["Port"].value,
    )
    state.udp_server = UDPConnectionServer(connection_object)

    def _udp_setting_change(should_be_running: bool) -> None:
        if state.udp_server.is_running:
            if not should_be_running:
                logger.info("UDP server is now " + "disabled")
                state.udp_server.close()
        else:
            if should_be_running:
                logger.info("UDP server is now " + "enabled")
                state.udp_server.start()

    setting_enabled.connect(_udp_setting_change)


def set_dronecan_handlers(state: "yukon.domain.god_state.GodState") -> None:
    def _handle_dronecan_fileserver_enabled_change(should_be_running: bool) -> None:
        if state.dronecan.fileserver and should_be_running:
            logger.info("DroneCAN fileserver is already running")
            return
        if state.dronecan.fileserver and not should_be_running:
            logger.info("DroneCAN fileserver is now disabled")
            state.dronecan.fileserver.stop()
            state.dronecan.fileserver = None
            return
        if not state.dronecan.fileserver and should_be_running:
            if not state.dronecan.node:
                logger.info("DroneCAN node is not yet ready, postponing fileserver start")
                return
            logger.info("DroneCAN fileserver is now enabled")
            state.dronecan.fileserver = SimpleFileServer(state.dronecan.node, state.dronecan.firmware_update_path.value)
            state.dronecan.fileserver.start()

    def _handle_dronecan_fileserver_path_change(new_value: str) -> None:
        if state.dronecan.fileserver:
            logger.info("DroneCAN fileserver path changed to " + new_value)
            state.dronecan.fileserver.file_path = new_value

    def _handle_dronecan_enabled_change(should_be_running: bool) -> None:
        if state.dronecan.is_running:
            if not should_be_running:
                logger.info("DroneCAN is now disabled")
                state.dronecan.is_running = False
                state.dronecan.thread.join()
                state.dronecan.fileserver = None
                state.dronecan.thread = None
                state.dronecan.node_monitor = None
                state.dronecan.driver = None
                state.dronecan.allocator = None
        elif not state.dronecan.is_running:
            if should_be_running:
                state.queues.god_queue.put_nowait(RequestRunDronecan())

    _handle_dronecan_enabled_change(state.dronecan.enabled.value)
    _handle_dronecan_fileserver_enabled_change(state.dronecan.firmware_update_enabled.value)
    state.dronecan.enabled.connect(_handle_dronecan_enabled_change)
    state.dronecan.firmware_update_enabled.connect(_handle_dronecan_fileserver_enabled_change)
    state.dronecan.firmware_update_path.connect(_handle_dronecan_fileserver_path_change)


def set_file_server_handler(state: "yukon.domain.god_state.GodState") -> None:
    def _handle_path_change(new_value: str) -> None:
        logger.info("File server path changed to " + new_value)
        if state.cyphal.file_server:
            state.cyphal.file_server.roots = [new_value]

    def _handle_enabled_change(should_be_enabled: bool) -> None:
        is_already_running = state.cyphal.file_server is not None
        if is_already_running:
            if not should_be_enabled:
                state.cyphal.file_server.close()
                state.cyphal.file_server = None
        else:
            if should_be_enabled:

                def _run_file_server() -> None:
                    state.cyphal.file_server = FileServer(
                        state.cyphal.local_node, [state.settings["Firmware updates"]["File path"]["value"].value]
                    )
                    logger.info(
                        "File server started on path " + state.settings["Firmware updates"]["File path"]["value"].value
                    )
                    state.cyphal.file_server.start()

                if not state.cyphal_worker_asyncio_loop:
                    logger.debug("No asyncio loop, postponing allocator run")
                    state.callbacks["yukon_node_attached"].append(_run_file_server)
                else:
                    assert state.cyphal.local_node
                    assert state.cyphal.local_node.id
                    state.cyphal_worker_asyncio_loop.call_soon_threadsafe(_run_file_server)

    state.settings["Firmware updates"]["File path"]["value"].connect(_handle_path_change)
    state.settings["Firmware updates"]["Enabled"].connect(_handle_enabled_change)
    _handle_enabled_change(state.settings["Firmware updates"]["Enabled"].value)


async def send_store_presistent_states_to_node(
    state: "yukon.domain.god_state.GodState", target_node_id: int, delay: float
) -> None:
    await asyncio.sleep(delay)
    stop_retry = False
    retry_count = 0
    while not stop_retry:
        if retry_count > 5:
            logger.error(
                "Failed to send persistent states to node %s, tried %d times", str(target_node_id), retry_count
            )
            return
        restart_command = uavcan.node.ExecuteCommand_1_0.Request()
        restart_command.command = uavcan.node.ExecuteCommand_1_0.Request.COMMAND_STORE_PERSISTENT_STATES
        command_client = state.cyphal.local_node.make_client(uavcan.node.ExecuteCommand_1_0, target_node_id)
        response_tuple = await command_client.call(restart_command)
        message = None
        if response_tuple:
            stop_retry = True
            response = response_tuple[0]
            if response.status == 1:
                message = "Device responds: failure"
            elif response.status == 2:
                message = "Device responds: not authorized"
            elif response.status == 3:
                message = "Device responds: bad command"
            elif response.status == 4:
                message = "Device responds: bad parameter"
            elif response.status == 5:
                message = "Device responds: bad state"
            elif response.status == 6:
                message = "Device responds: internal error"
            else:
                message = repr(response)
                if response.status == 0:
                    message = "✓ " + message
                    message += " (success)"
        was_command_success = response is not None and response.status == 0
        if not was_command_success:
            logger.error("Failed to send store persistent states to node %s", str(target_node_id))
            if message:
                logger.error(message)
            retry_count += 1
        else:
            logger.info("Successfully sent store persistent states to node %s", str(target_node_id))
            return


def set_allocator_handler(state: "yukon.domain.god_state.GodState") -> None:
    def _handle_mode_change(new_mode: str) -> None:
        if (new_mode in ["Automatic", "Automatic persistent allocation"]) and not state.cyphal.centralized_allocator:
            logger.info("Some kind of automatic allocator is now enabled")
            # For the current thread, the same event loop is used
            def _run_allocator() -> None:
                def _run_allocator_inner() -> None:
                    try:
                        if state.cyphal.local_node:
                            logger.debug("Now running allocator")
                            state.cyphal.centralized_allocator = CentralizedAllocator(state.cyphal.local_node)
                            state.cyphal.centralized_allocator.start()

                            def allocated_hook(allocated_node_id: int) -> None:
                                logger.debug("Handling allocation of node %d", allocated_node_id)
                                if new_mode == "Automatic persistent allocation":
                                    logger.debug("Now sending store persistent states to node %d", allocated_node_id)
                                    state.cyphal_worker_asyncio_loop.create_task(
                                        send_store_presistent_states_to_node(state, allocated_node_id, delay=0.5)
                                    )

                            state.cyphal.centralized_allocator.allocated_node_hooks.append(allocated_hook)

                            logger.info("Allocator is now running")
                        else:
                            logger.debug("Scheduled allocator to run when local node is set")

                    except:
                        logger.exception("Exception while running allocator")
                        tb = traceback.format_exc()
                        logger.error(tb)

                if (
                    not state.cyphal_worker_asyncio_loop
                    or not state.cyphal.local_node
                    or not state.cyphal.local_node.id  # This is fine to check because if state.cyphal.local_node was None then this condition wouldn't be checked
                ):
                    logger.debug("No asyncio loop, postponing allocator run")
                    state.callbacks["yukon_node_attached"].append(_run_allocator)
                else:
                    assert state.cyphal.local_node
                    assert state.cyphal.local_node.id
                    state.cyphal_worker_asyncio_loop.call_soon_threadsafe(_run_allocator_inner)

            _run_allocator()
        elif new_mode == "Manual" and state.cyphal.centralized_allocator:
            logger.info("Allocator is now stopped")
            state.cyphal.centralized_allocator.close()
            state.cyphal.centralized_allocator = None

    _handle_mode_change(state.settings["Node allocation"]["chosen_value"].value)
    state.settings["Node allocation"]["chosen_value"].connect(_handle_mode_change)


def set_dsdl_path_change_handler(state: "yukon.domain.god_state.GodState") -> None:
    def _handle_dsdl_path_change(_: typing.Any) -> None:
        # Add $HOME/.pycyphal to sys.path
        home = os.path.expanduser("~")
        pycyphal_path = os.path.join(home, ".pycyphal")
        add_path_to_sys_path(pycyphal_path)
        logger.info(
            "DSDL paths list is now this: "
            + json.dumps(state.settings["DSDL search directories"].value, cls=EnhancedJSONEncoder)
        )
        # Make sure that all paths in state.settings["DSDL search directories"].value are in the CYPHAL_PATH environment variable
        # If not, add them
        dsdl_paths = state.settings["DSDL search directories"].value
        # This is a dirty hack to remove import hooks, this should instead be done in Pycyphal, see issue #270
        for entry in sys.meta_path.copy():
            if isinstance(entry, DsdlMetaFinder) and type(entry).__name__ == "DsdlMetaFinder":
                sys.meta_path.remove(entry)
        real_dsdl_paths = []
        for dsdl_path in dsdl_paths:
            if isinstance(dsdl_path, ReactiveValue):
                real_dsdl_path_str = dsdl_path["value"].value
                # Make sure real_dsdl_path_str exists
                if not os.path.exists(real_dsdl_path_str):
                    logger.error("DSDL lookup path %s does not exist", real_dsdl_path_str)
                    continue
                real_dsdl_paths.append(real_dsdl_path_str)
        if len(real_dsdl_paths) == 0:
            logger.error("No DSDL paths are valid, this is a problem")
            return
        install_import_hook(real_dsdl_paths)

    state.settings["DSDL search directories"].connect(_handle_dsdl_path_change)
    _handle_dsdl_path_change(None)


def set_handlers_for_configuration_changes(state: "yukon.domain.god_state.GodState") -> None:
    set_dronecan_handlers(state)
    set_file_server_handler(state)
    set_allocator_handler(state)
    set_udp_server_handlers(state)
    set_dsdl_path_change_handler(state)
