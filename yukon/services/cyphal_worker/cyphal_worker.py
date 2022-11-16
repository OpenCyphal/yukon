import asyncio
import logging

import typing

import pycyphal
from pycyphal.application import make_node, NodeInfo, make_registry
import pycyphal.transport.can
import dronecan

import uavcan
import uavcan.pnp
import yukon.domain.god_state
from yukon.domain.detach_transport_request import DetachTransportRequest
from yukon.domain.subscribe_request import SubscribeRequest
from yukon.domain.unsubscribe_request import UnsubscribeRequest
from yukon.domain.apply_configuration_request import ApplyConfigurationRequest
from yukon.domain.attach_transport_request import AttachTransportRequest
from yukon.domain.command_send_request import CommandSendRequest
from yukon.domain.reread_registers_request import RereadRegistersRequest
from yukon.domain.update_register_request import UpdateRegisterRequest
from yukon.services.cyphal_worker.unsubscribe_requests_work import do_unsubscribe_requests_work
from yukon.services.cyphal_worker.detach_transport_work import do_detach_transport_work
from yukon.services.cyphal_worker.subscribe_requests_work import do_subscribe_requests_work
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

        except Exception as e:
            logger.exception(e)
            raise e

    asyncio.run(_internal_method())
