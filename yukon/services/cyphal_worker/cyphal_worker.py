import asyncio
import logging

import typing

import pycyphal
from pycyphal.application import make_node, NodeInfo, make_registry

import uavcan
import yukon.domain.god_state
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


def set_up_node_id_request_detection(state: "yukon.domain.god_state.GodState"):
    allocation_data_sub = state.cyphal.local_node.make_subscriber(uavcan.pnp.NodeIDAllocationData_1_0)

    def receive_allocate_request(msg: typing.Any, metadata: pycyphal.transport.TransferFrom):
        pass

    allocation_data_sub.receive_in_background(receive_allocate_request)


def cyphal_worker(state: GodState) -> None:
    """It starts the node and keeps adding any transports that are queued for adding"""

    async def _internal_method() -> None:
        try:
            my_registry = make_registry()
            my_registry["uavcan.node.id"] = 13
            state.cyphal.local_node = make_node(
                NodeInfo(name="org.opencyphal.yukon"), my_registry,
                reconfigurable_transport=True
            )

            state.cyphal.local_node.start()
            state.cyphal.pseudo_transport = state.cyphal.local_node.presentation.transport

            make_tracers_trackers(state)

            logger.debug("Tracers should have been set up.")
            while state.gui.gui_running:
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
                    elif state.settings["Node allocation"][
                        "chosen_value"] == "Automatic" and state.cyphal.local_node.id:
                        state.cyphal.centralized_allocator = CentralizedAllocator(state.cyphal.local_node)
                except:
                    logger.exception("A failure with the centralized allocator")

                try:
                    if not state.cyphal.file_server:
                        if state.settings["Firmware updates"]["Enabled"] == True:
                            state.cyphal.file_server = FileServer(state.cyphal.local_node, [
                                state.settings["Firmware updates"]["File path"]["value"]
                            ])
                            logger.info("File server started on path " + state.settings["Firmware updates"]["File path"]["value"])
                            state.cyphal.file_server.start()
                    else:
                        if state.settings["Firmware updates"]["Enabled"] == False:
                            logger.info(
                                "File server stopped on path " + state.settings["Firmware updates"]["File path"]["value"])
                            state.cyphal.file_server.close()
                            state.cyphal.file_server = None
                except:
                    logger.exception("A failure with the file server")

                await asyncio.sleep(0.05)
                await do_attach_transport_work(state)
                await asyncio.sleep(0.02)
                await do_detach_transport_work(state)
                await asyncio.sleep(0.02)
                await do_subscribe_requests_work(state)
                await asyncio.sleep(0.02)
                await do_unsubscribe_requests_work(state)
                await asyncio.sleep(0.02)
                await do_update_register_work(state)
                await asyncio.sleep(0.02)
                await do_apply_configuration_work(state)
                await asyncio.sleep(0.02)
                await do_send_command_work(state)
                await asyncio.sleep(0.02)
                await do_reread_registers_work(state)
                await asyncio.sleep(0.02)
                await do_reread_register_names_work(state)
        except Exception as e:
            logger.exception(e)
            raise e

    asyncio.run(_internal_method())
