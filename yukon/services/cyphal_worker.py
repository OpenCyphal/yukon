import asyncio
import json
import logging
import traceback

from pycyphal.application import make_node, NodeInfo, make_transport

import uavcan
from domain.reread_registers_request import RereadRegistersRequest
from yukon.domain.update_register_request import UpdateRegisterRequest
from yukon.services.value_utils import unexplode_value
from yukon.domain.attach_transport_request import AttachTransportRequest
from yukon.domain.attach_transport_response import AttachTransportResponse
from yukon.domain.god_state import GodState
from yukon.services.snoop_registers import make_tracers_trackers
from yukon.services.snoop_registers import get_register_value

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")


def cyphal_worker(state: GodState) -> None:
    """It starts the node and keeps adding any transports that are queued for adding"""

    async def _internal_method() -> None:
        try:
            state.cyphal.local_node = make_node(
                NodeInfo(name="com.zubax.sapog.tests.debugger"), reconfigurable_transport=True
            )
            state.cyphal.local_node.start()
            state.cyphal.local_node.registry["uavcan.node.id"] = 13
            state.cyphal.pseudo_transport = state.cyphal.local_node.presentation.transport
            make_tracers_trackers(state)
            print("Tracers should have been set up.")
            while state.gui.gui_running:
                await asyncio.sleep(0.1)
                if not state.queues.attach_transport.empty():
                    try:
                        atr: AttachTransportRequest = state.queues.attach_transport.get_nowait()
                        new_transport = make_transport(atr.get_registry())
                        state.cyphal.pseudo_transport.attach_inferior(new_transport)
                        attach_transport_response = AttachTransportResponse(True, atr.requested_interface.iface)
                        state.queues.attach_transport_response.put(attach_transport_response)
                        print("Added a new interface")
                    except Exception as e:
                        tb = traceback.format_exc()
                    else:
                        tb = "Attached transport"
                    finally:
                        attach_transport_response = AttachTransportResponse(False, tb)
                        state.queues.attach_transport_response.put(attach_transport_response)
                if not state.queues.detach_transport.empty():
                    transport = state.queues.detach_transport.get_nowait()
                    state.cyphal.pseudo_transport.detach_inferior(transport)
                if not state.queues.update_registers.empty():
                    register_update = state.queues.update_registers.get_nowait()
                    # make a uavcan.register.Access_1 request to the node
                    try:
                        client = state.cyphal.local_node.make_client(uavcan.register.Access_1, register_update.node_id)
                        request = uavcan.register.Access_1.Request()
                        request.name.name = register_update.register_name
                        request.value = register_update.value
                        # We don't need the response here because it is snooped by an avatar anyway
                        asyncio.create_task(client.call(request))
                    except:
                        logger.exception(
                            "Failed to update register %s for %s",
                            register_update.register_name,
                            register_update.node_id,
                        )
                if not state.queues.apply_configuration.empty():
                    config = state.queues.apply_configuration.get_nowait()
                    if config.node_id:
                        # Make a new client for access request and config.node_id
                        client = state.cyphal.local_node.make_client(uavcan.register.Access_1, config.node_id)
                        # Make a uavcan.register.Access_1 request to the node
                        request = uavcan.register.Access_1.Request()
                        data = json.loads(config.configuration)
                        for k, v in data.items():
                            if k[-5:] == ".type":
                                continue
                            state.queues.update_registers.put(
                                UpdateRegisterRequest(k, unexplode_value(v), config.node_id)
                            )
                    else:
                        logger.debug("Setting configuration for all configured nodes")
                        data = json.loads(config.configuration)
                        for node_id, register_values_exploded in data.items():
                            if "__" in node_id:
                                continue
                            # If register_values_exploded is not a dict, it is an error
                            if not isinstance(register_values_exploded, dict):
                                logger.error(f"Configuration for node {node_id} is not a dict")
                                continue
                            for k, v in register_values_exploded.items():
                                if k[-5:] == ".type":
                                    continue
                                state.queues.update_registers.put(
                                    UpdateRegisterRequest(k, unexplode_value(v), int(node_id))
                                )
                if not state.queues.reread_registers.empty():
                    request2: RereadRegistersRequest = state.queues.reread_registers.get_nowait()
                    for pair in request2.pairs:
                        logger.debug("Rereading register %s for node %s", pair[0], pair[1])
                        node_id2 = int(pair[0])
                        register_name2 = pair[1]
                        asyncio.create_task(get_register_value(state, node_id2, register_name2))
        except Exception as e:
            logger.exception(e)
            raise e

    asyncio.run(_internal_method())
