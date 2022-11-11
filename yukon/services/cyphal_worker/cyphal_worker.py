import asyncio
import logging
import threading

import typing

import pycyphal
from pycyphal.application import make_node, NodeInfo, make_registry
import pycyphal.transport.can
import dronecan

import uavcan
import uavcan.pnp
import yukon.domain.god_state
from yukon.domain.detach_transport_request import DetachTransportRequest
from yukon.domain.command_send_response import CommandSendResponse
from yukon.domain.subscribe_request import SubscribeRequest
from yukon.domain.unsubscribe_request import UnsubscribeRequest
from yukon.domain.apply_configuration_request import ApplyConfigurationRequest
from yukon.domain.attach_transport_request import AttachTransportRequest
from yukon.domain.command_send_request import CommandSendRequest
from yukon.domain.reread_registers_request import RereadRegistersRequest
from yukon.domain.update_register_request import UpdateRegisterRequest
from yukon.services.cyphal_worker.forward_dronecan_work import do_forward_dronecan_work
from yukon.services.flash_dronecan_firmware_with_cyphal_firmware import run_dronecan_firmware_updater
from yukon.services.FileServer import FileServer
from yukon.services.CentralizedAllocator import CentralizedAllocator
from yukon.services.cyphal_worker.unsubscribe_requests_work import do_unsubscribe_requests_work
from yukon.services.cyphal_worker.detach_transport_work import do_detach_transport_work
from yukon.services.cyphal_worker.subscribe_requests_work import do_subscribe_requests_work
from yukon.services.cyphal_worker.reread_register_names_work import do_reread_register_names_work
from yukon.services.cyphal_worker.reread_registers_work import do_reread_registers_work
from yukon.services.cyphal_worker.send_command_work import do_send_command_work
from yukon.services.cyphal_worker.attach_transport_work import do_attach_transport_work
from yukon.services.cyphal_worker.update_configuration_work import do_apply_configuration_work
from yukon.services.cyphal_worker.update_register_work import do_update_register_work
from yukon.domain.god_state import GodState
from yukon.services.snoop_registers import make_tracers_trackers

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")


def set_up_node_id_request_detection(state: "yukon.domain.god_state.GodState") -> None:
    allocation_data_sub = state.cyphal.local_node.make_subscriber(uavcan.pnp.NodeIDAllocationData_1_0)

    def receive_allocate_request(msg: typing.Any, metadata: pycyphal.transport.TransferFrom) -> None:
        pass

    allocation_data_sub.receive_in_background(receive_allocate_request)


def handle_settings_of_fileserver_and_allocator(state: "yukon.domain.god_state.GodState") -> None:
    try:
        if state.cyphal.centralized_allocator:
            if state.settings["Node allocation"]["chosen_value"] == "Automatic":
                if not state.cyphal.centralized_allocator.running:
                    logger.info("Allocator is now running")
                    state.cyphal.centralized_allocator.start()
            else:
                if state.cyphal.centralized_allocator.running:
                    logger.info("Allocator is now stopped")
                    state.cyphal.centralized_allocator.close()
                    state.cyphal.centralized_allocator = None
        elif state.settings["Node allocation"]["chosen_value"] == "Automatic" and state.cyphal.local_node.id:
            state.cyphal.centralized_allocator = CentralizedAllocator(state.cyphal.local_node)
    except:
        logger.exception("A failure with the centralized allocator")

    try:
        if not state.cyphal.file_server:
            if state.settings["Firmware updates"]["Enabled"]:
                state.cyphal.file_server = FileServer(
                    state.cyphal.local_node, [state.settings["Firmware updates"]["File path"]["value"]]
                )
                logger.info("File server started on path " + state.settings["Firmware updates"]["File path"]["value"])
                state.cyphal.file_server.start()
        else:
            if not state.settings["Firmware updates"]["Enabled"]:
                logger.info("File server stopped on path " + state.settings["Firmware updates"]["File path"]["value"])
                state.cyphal.file_server.close()
                state.cyphal.file_server = None
    except:
        logger.exception("A failure with the file server")


def handle_settings_for_dronecan_conversion(state: "yukon.domain.god_state.GodState") -> None:
    should_be_running = state.settings["DroneCAN firmware substitution"]["Enabled"]
    is_dronecan_firmware_path_available = (
        state.settings["DroneCAN firmware substitution"]["Substitute firmware path"]["value"] != ""
    )
    if not state.dronecan.is_running:
        if should_be_running and is_dronecan_firmware_path_available:
            state.dronecan.thread = threading.Thread(target=run_dronecan_firmware_updater, args=(state,))
    else:
        if not should_be_running:
            state.dronecan.is_running = False
            state.dronecan.thread.join()
            state.dronecan.file_server = None
            state.dronecan.thread = None
            state.dronecan.node_monitor = None
            state.dronecan.driver = None
            state.dronecan.allocator = None


def cyphal_worker(state: GodState) -> None:
    async def _internal_method() -> None:
        try:
            my_registry = make_registry()
            my_registry["uavcan.node.id"] = 13
            state.cyphal.local_node = make_node(
                NodeInfo(name="org.opencyphal.yukon"), my_registry, reconfigurable_transport=True
            )

            state.cyphal.local_node.start()

            def handle_transmit_message_to_dronecan(capture: pycyphal.transport.Capture) -> None:
                if isinstance(capture, pycyphal.transport.can.CANCapture):
                    can_frame = dronecan.driver.CANFrame(
                        capture.frame.identifier, capture.frame.data, True, canfd=False
                    )
                    state.cyphal.dronecan_traffic_queues.input_queue.put_nowait(can_frame)

            state.cyphal.local_node.presentation.transport.begin_capture(handle_transmit_message_to_dronecan)
            state.cyphal.pseudo_transport = state.cyphal.local_node.presentation.transport

            make_tracers_trackers(state)

            logger.debug("Tracers should have been set up.")
            while state.gui.gui_running:
                queue_element = await state.queues.god_queue.get()
                if isinstance(queue_element, AttachTransportRequest):
                    await do_attach_transport_work(state, queue_element)
                elif isinstance(queue_element, DetachTransportRequest):
                    await do_detach_transport_work(state, queue_element)
                elif isinstance(queue_element, UpdateRegisterRequest):
                    await do_update_register_work(state, queue_element)
                elif isinstance(queue_element, ApplyConfigurationRequest):
                    await do_apply_configuration_work(state, queue_element)
                elif isinstance(queue_element, CommandSendRequest):
                    await do_send_command_work(state, queue_element)
                elif isinstance(queue_element, RereadRegistersRequest):
                    await do_reread_registers_work(state, queue_element)
                elif isinstance(queue_element, SubscribeRequest):
                    await do_subscribe_requests_work(state, queue_element)
                elif isinstance(queue_element, UnsubscribeRequest):
                    await do_unsubscribe_requests_work(state, queue_element)

        except Exception as e:
            logger.exception(e)
            raise e

    asyncio.run(_internal_method())
