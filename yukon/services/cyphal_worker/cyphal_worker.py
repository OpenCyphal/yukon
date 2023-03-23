import asyncio
import logging
import threading
import traceback

import typing
from uuid import uuid4

import pycyphal
from pycyphal.application import make_node, NodeInfo, make_registry
import pycyphal.transport.can
import dronecan
from pycyphal.transport.can import CANCapture
from pycyphal.transport.udp import UDPCapture
from pycyphal.transport.can.media import DataFrame, FrameFormat, Envelope

import uavcan
import uavcan.pnp
from yukon.domain.fileserver.change_fileserver_path_request import ChangeFileserverPathRequest
import yukon.domain.god_state
from yukon.domain.registers.reread_register_names_request import RereadRegisterNamesRequest
from yukon.domain.request_run_dronecan import RequestRunDronecan
from yukon.domain.simple_publisher import SimplePublisher
from yukon.domain.fileserver.stop_fileserver_request import StopFileserverRequest
from yukon.services.FileServer import FileServer
from yukon.domain.transport.detach_transport_request import DetachTransportRequest
from yukon.domain.subscriptions.subscribe_request import SubscribeRequest
from yukon.domain.subscriptions.unsubscribe_request import UnsubscribeRequest
from yukon.domain.registers.apply_configuration_request import ApplyConfigurationRequest
from yukon.domain.transport.attach_transport_request import AttachTransportRequest
from yukon.domain.command_send_request import CommandSendRequest
from yukon.domain.registers.reread_registers_request import RereadRegistersRequest
from yukon.domain.registers.update_register_request import UpdateRegisterRequest
from yukon.services.cyphal_worker.unsubscribe_requests_work import do_unsubscribe_requests_work
from yukon.services.cyphal_worker.detach_transport_work import do_detach_transport_work
from yukon.services.cyphal_worker.subscribe_requests_work import do_subscribe_requests_work
from yukon.services.cyphal_worker.reread_registers_work import do_reread_registers_work
from yukon.services.cyphal_worker.send_command_work import do_send_command_work
from yukon.services.cyphal_worker.attach_transport_work import do_attach_transport_work
from yukon.services.cyphal_worker.update_configuration_work import do_apply_configuration_work
from yukon.services.cyphal_worker.update_register_work import do_update_register_work
from yukon.domain.god_state import GodState
from yukon.services.mydronecan.dronecan_stuff import run_dronecan
from yukon.services.avatar_handler import make_tracers_trackers
from yukon.services.snoop_registers import get_register_names
from yukon.domain.publishers.create_publisher_request import CreatePublisherRequest
from yukon.domain.publishers.publish_request import PublishRequest
from yukon.services.dtype_loader import FormatError, load_dtype

logger = logging.getLogger(__name__)


def set_up_node_id_request_detection(state: "yukon.domain.god_state.GodState") -> None:
    allocation_data_sub = state.cyphal.local_node.make_subscriber(uavcan.pnp.NodeIDAllocationData_1_0)

    def receive_allocate_request(msg: typing.Any, metadata: pycyphal.transport.TransferFrom) -> None:
        pass

    allocation_data_sub.receive_in_background(receive_allocate_request)


def cyphal_worker(state: GodState) -> None:
    async def _internal_method() -> None:
        try:
            thread_state = {"publishers_by_id": {}, "allocator_mode": "Automatic persistent allocation"}
            my_registry = make_registry()
            state.cyphal.local_node = make_node(
                NodeInfo(name="org.opencyphal.yukon"), my_registry, reconfigurable_transport=True
            )

            state.cyphal.local_node.start()

            state.cyphal.pseudo_transport = state.cyphal.local_node.presentation.transport

            make_tracers_trackers(state)

            logger.debug("Tracers should have been set up.")
            while state.gui.gui_running:
                # An empty element is going to be inserted here on application shutdown to get the loop to exit.
                queue_element = await asyncio.get_running_loop().run_in_executor(None, state.queues.god_queue.get)
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
                elif isinstance(queue_element, RequestRunDronecan):
                    logger.debug("A request to run the DroneCAN firmware updater was received.")
                    state.dronecan.thread = threading.Thread(target=run_dronecan, args=(state,), daemon=True)
                    state.dronecan.thread.start()
                    logger.info("DroneCAN firmware substitution is now " + "enabled")
                elif isinstance(queue_element, RereadRegisterNamesRequest):
                    logger.debug("A request to reread the register names was received.")
                    await get_register_names(
                        state,
                        queue_element.node_id,
                        state.avatar.avatars_by_node_id[queue_element.node_id],
                        True,
                    )
                elif isinstance(queue_element, CreatePublisherRequest):
                    simple_publisher = SimplePublisher(str(uuid4()), state)
                    simple_publisher.publisher = state.cyphal.local_node.make_publisher(
                        load_dtype(queue_element.datatype_name), queue_element.port_id
                    )
                    thread_state["publishers_by_id"][simple_publisher.publisher_id] = simple_publisher
                    state.queues.create_publisher_response.put_nowait(simple_publisher)
                elif isinstance(queue_element, PublishRequest):
                    publisher = thread_state["publishers_by_id"].get(queue_element.publisher_id)
                    if not publisher:
                        logger.warning("No publisher with ID " + queue_element.publisher_id)
                        continue
                    await publisher.publish()
                elif isinstance(queue_element, StopFileserverRequest):
                    state.cyphal.file_server.close()
                    state.cyphal.file_server = None
                elif isinstance(queue_element, ChangeFileserverPathRequest):
                    state.cyphal.file_server.roots = [queue_element.path]
                elif isinstance(queue_element, CANCapture):
                    frame: dronecan.driver.CANFrame = queue_element
                    if not isinstance(frame, dronecan.driver.CANFrame):
                        logger.warning("Not a dronecan frame")
                        continue
                    # This is a pycyphal construct
                    frame_format: FrameFormat = FrameFormat.EXTENDED if frame.extended else FrameFormat.BASE
                    # This is a pycyphal construct
                    dataframe: DataFrame = DataFrame(frame_format, frame.id, frame.data)
                    # This is a pycyphal construct
                    for inferior in state.cyphal.local_node.presentation.transport.inferiors:
                        await inferior.spoof_frames([dataframe], asyncio.get_running_loop().time() + 1)

        except Exception as e:
            logger.exception(e)
            raise e

    asyncio.run(_internal_method())
