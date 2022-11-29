import asyncio
import logging
import threading
import traceback

import yukon
from yukon.domain.request_run_dronecan_firmware_updater import RequestRunDronecanFirmwareUpdater
from yukon.domain.start_fileserver_request import StartFileServerRequest
from yukon.services.CentralizedAllocator import CentralizedAllocator
from yukon.services.FileServer import FileServer
from yukon.services.flash_dronecan_firmware_with_cyphal_firmware import run_dronecan_firmware_updater

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


def set_dronecan_handlers(state: "yukon.domain.god_state.GodState") -> None:
    s1 = state.settings.get("DroneCAN firmware substitution")
    if s1:
        s2 = s1.get("Enabled")

        def _handle_setting_change(should_be_running: bool) -> None:
            if state.dronecan.is_running:
                if not should_be_running:
                    logger.info("DroneCAN firmware substitution is now " + "disabled")
                    state.dronecan.is_running = False
                    state.dronecan.thread.join()
                    state.dronecan.file_server = None
                    state.dronecan.thread = None
                    state.dronecan.node_monitor = None
                    state.dronecan.driver = None
                    state.dronecan.allocator = None
            elif not state.dronecan.is_running:
                if should_be_running:
                    state.queues.god_queue.put_nowait(RequestRunDronecanFirmwareUpdater())

        s2.connect(_handle_setting_change)


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
                state.queues.god_queue.put_nowait(StartFileServerRequest())

    state.settings["Firmware updates"]["File path"]["value"].connect(_handle_path_change)
    state.settings["Firmware updates"]["Enabled"].connect(_handle_enabled_change)


def set_allocator_handler(state: "yukon.domain.god_state.GodState") -> None:
    def _handle_mode_change(new_mode: str) -> None:
        if new_mode == "Automatic" and not state.cyphal.centralized_allocator and state.cyphal.local_node.id:
            # For the current thread, the same event loop is used

            def _run_allocator() -> None:
                logger.debug("Now running allocator")
                try:
                    state.cyphal.centralized_allocator = CentralizedAllocator(state.cyphal.local_node)
                    state.cyphal.centralized_allocator.start()
                    logger.info("Allocator is now running")
                except:
                    logger.exception("Exception while running allocator")
                    tb = traceback.format_exc()
                    logger.error(tb)

            state.cyphal_worker_asyncio_loop.call_soon_threadsafe(_run_allocator)
        elif new_mode == "Manual" and state.cyphal.centralized_allocator:
            logger.info("Allocator is now stopped")
            state.cyphal.centralized_allocator.close()
            state.cyphal.centralized_allocator = None

    state.settings["Node allocation"]["chosen_value"].connect(_handle_mode_change)


def set_handlers_for_configuration_changes(state: "yukon.domain.god_state.GodState") -> None:
    set_dronecan_handlers(state)
    set_file_server_handler(state)
    set_allocator_handler(state)
