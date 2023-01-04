import asyncio
import logging
import threading
import traceback

import typing

import pycyphal
from pycyphal.application import make_node, NodeInfo, make_registry
import pycyphal.transport.can
import dronecan
from pycyphal.transport.can import CANCapture
from pycyphal.transport.udp import UDPCapture

import uavcan
import uavcan.pnp
import yukon.domain.god_state
from yukon.domain.request_run_dronecan_firmware_updater import RequestRunDronecanFirmwareUpdater
from yukon.domain.start_fileserver_request import StartFileServerRequest
from yukon.services.FileServer import FileServer
from yukon.domain.transport.detach_transport_request import DetachTransportRequest
from yukon.domain.subscriptions.subscribe_request import SubscribeRequest
from yukon.domain.subscriptions.unsubscribe_request import UnsubscribeRequest
from yukon.domain.registers.apply_configuration_request import ApplyConfigurationRequest
from yukon.domain.transport.attach_transport_request import AttachTransportRequest
from yukon.domain.command_send_request import CommandSendRequest
from yukon.domain.registers.reread_registers_request import RereadRegistersRequest
from yukon.domain.registers.update_register_request import UpdateRegisterRequest
from yukon.services.cyphal_worker.forward_dronecan_work import do_forward_dronecan_work
from yukon.services.cyphal_worker.unsubscribe_requests_work import do_unsubscribe_requests_work
from yukon.services.cyphal_worker.detach_transport_work import do_detach_transport_work
from yukon.services.cyphal_worker.subscribe_requests_work import do_subscribe_requests_work
from yukon.services.cyphal_worker.reread_registers_work import do_reread_registers_work
from yukon.services.cyphal_worker.send_command_work import do_send_command_work
from yukon.services.cyphal_worker.attach_transport_work import do_attach_transport_work
from yukon.services.cyphal_worker.update_configuration_work import do_apply_configuration_work
from yukon.services.cyphal_worker.update_register_work import do_update_register_work
from yukon.domain.god_state import GodState
from yukon.services.flash_dronecan_firmware_with_cyphal_firmware import run_dronecan_firmware_updater
from yukon.services.snoop_registers import make_tracers_trackers

logger = logging.getLogger(__name__)
# logger.setLevel("NOTSET")


def set_up_node_id_request_detection(state: "yukon.domain.god_state.GodState") -> None:
    allocation_data_sub = state.cyphal.local_node.make_subscriber(uavcan.pnp.NodeIDAllocationData_1_0)

    def receive_allocate_request(msg: typing.Any, metadata: pycyphal.transport.TransferFrom) -> None:
        pass

    allocation_data_sub.receive_in_background(receive_allocate_request)


# logger.setLevel(logging.DEBUG)


def cyphal_worker(state: GodState) -> None:
    async def _internal_method() -> None:
        try:
            my_registry = make_registry()
            state.cyphal.local_node = make_node(
                NodeInfo(name="org.opencyphal.yukon"), my_registry, reconfigurable_transport=True
            )

            state.cyphal.local_node.start()
            state.cyphal_worker_asyncio_loop = asyncio.get_running_loop()

            async def forward_dronecan_loop() -> None:
                try:
                    while state.gui.gui_running:
                        await do_forward_dronecan_work(state)
                except Exception as e:
                    tb = traceback.format_exc()
                    logger.error(tb)
                logger.warn("Dronecan forwarding done")

            task = asyncio.create_task(forward_dronecan_loop())

            state.cyphal.pseudo_transport = state.cyphal.local_node.presentation.transport

            make_tracers_trackers(state)
            # if isinstance(state.callbacks.get("yukon_node_created"), typing.List):
            #     for callback in state.callbacks["yukon_node_created"]:
            #         if callable(callback):
            #             callback(state)

            logger.debug("Tracers should have been set up.")
            while state.gui.gui_running:
                # An empty element is going to be inserted here on application shutdown to get the loop to exit.
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
                elif isinstance(queue_element, RequestRunDronecanFirmwareUpdater):
                    logger.debug("A request to run the DroneCAN firmware updater was received.")
                    fpath = state.settings["DroneCAN firmware substitution"]["Substitute firmware path"]["value"].value
                    is_dronecan_firmware_path_available = fpath != ""
                    if is_dronecan_firmware_path_available:
                        state.dronecan.thread = threading.Thread(
                            target=run_dronecan_firmware_updater, args=(state, fpath), daemon=True
                        )
                        state.dronecan.thread.start()
                        logger.info("DroneCAN firmware substitution is now " + "enabled")
                    else:
                        logger.error("DroneCAN firmware path is not set")
                        continue
        except Exception as e:
            logger.exception(e)
            raise e

    asyncio.run(_internal_method())
