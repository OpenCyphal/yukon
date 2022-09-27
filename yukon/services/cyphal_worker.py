import asyncio
import json
import logging
import subprocess
import traceback

import platform

from pycyphal.application import make_node, NodeInfo, make_transport

import uavcan
from yukon.services.api import is_configuration_simplified
from yukon.domain.reread_registers_request import RereadRegistersRequest
from yukon.domain.update_register_request import UpdateRegisterRequest
from yukon.services.value_utils import unexplode_value
from yukon.domain.attach_transport_request import AttachTransportRequest
from yukon.domain.attach_transport_response import AttachTransportResponse
from yukon.domain.god_state import GodState
from yukon.services.snoop_registers import make_tracers_trackers
from yukon.services.snoop_registers import get_register_value
from yukon.services.messages_publisher import add_local_message

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")

my_os = platform.system()


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
                await asyncio.sleep(0.05)
                if not state.queues.attach_transport.empty():
                    try:
                        atr: AttachTransportRequest = state.queues.attach_transport.get_nowait()
                        if atr.requested_interface.is_udp:
                            if not state.cyphal.already_used_transport_interfaces.get(
                                atr.requested_interface.udp_iface
                            ):
                                state.cyphal.already_used_transport_interfaces[atr.requested_interface.udp_iface] = True
                            else:
                                raise Exception("Interface already in use")
                        else:
                            if not state.cyphal.already_used_transport_interfaces.get(atr.requested_interface.iface):
                                state.cyphal.already_used_transport_interfaces[atr.requested_interface.iface] = True
                            else:
                                raise Exception("Interface already in use")
                        new_transport = make_transport(atr.get_registry())
                        state.cyphal.inferior_transports_by_interface_hashes[
                            str(hash(atr.requested_interface))
                        ] = new_transport
                        state.cyphal.pseudo_transport.attach_inferior(new_transport)
                        attach_transport_response = AttachTransportResponse(True, atr.requested_interface.iface)
                        state.cyphal.transports_list.append(atr.requested_interface)
                        state.queues.attach_transport_response.put(attach_transport_response)
                        print("Added a new interface")
                    except PermissionError as pe:
                        tb = traceback.format_exc()
                        if "You need special privileges" in str(pe):
                            if my_os == "Linux":
                                from tkinter import Tk, messagebox

                                ws = Tk()
                                ws.title("Python Guides")
                                ws.deiconify()
                                ws.lift()
                                ws.focus_force()
                                ws.geometry("1x1+0+0")
                                ws.config(bg="#5FB691")
                                messagebox.showinfo(
                                    "You need to adjust permissions for UDP packet sniffing",
                                    "The command is shown in the transport configuration window",
                                )
                                ws.withdraw()
                                ws.destroy()
                        attach_transport_response = AttachTransportResponse(False, tb, str(pe))
                        state.queues.attach_transport_response.put(attach_transport_response)
                    except Exception as e:
                        tb = traceback.format_exc()
                        attach_transport_response = AttachTransportResponse(False, tb, str(e))
                        state.queues.attach_transport_response.put(attach_transport_response)
                    else:
                        tb = "Attached transport"
                        attach_transport_response = AttachTransportResponse(True, tb)
                        state.queues.attach_transport_response.put(attach_transport_response)
                await asyncio.sleep(0.02)
                if not state.queues.detach_transport.empty():
                    interface_hash = state.queues.detach_transport.get_nowait()
                    transport_about_to_be_detached = state.cyphal.inferior_transports_by_interface_hashes[
                        interface_hash
                    ]
                    transport_about_to_be_detached.close()
                    state.cyphal.pseudo_transport.detach_inferior(transport_about_to_be_detached)
                    # find the interface in state.cyphal.transports_list which has the hash matching to interface_hash and remove it
                    for interface in state.cyphal.transports_list:
                        if str(hash(interface)) == interface_hash:
                            state.cyphal.transports_list.remove(interface)
                            break
                await asyncio.sleep(0.02)
                if not state.queues.update_registers.empty():
                    register_update = state.queues.update_registers.get_nowait()
                    # make a uavcan.register.Access_1 request to the node
                    try:
                        client = state.cyphal.local_node.make_client(uavcan.register.Access_1, register_update.node_id)
                        request = uavcan.register.Access_1.Request()
                        request.name.name = register_update.register_name
                        request.value = register_update.value
                        # We don't need the response here because it is snooped by an avatar anyway
                        response = await client.call(request)
                        if response is None:
                            add_local_message(
                                state,
                                "Failed to update register {}".format(register_update.register_name),
                                register_update.register_name,
                            )
                            continue
                        access_response, transfer_object = response
                        if not access_response.mutable:
                            add_local_message(
                                state,
                                "Register %s is not mutable." % register_update.register_name,
                                register_update.register_name,
                            )
                        if isinstance(access_response.value.empty, uavcan.primitive.Empty_1):
                            add_local_message(
                                state,
                                f"Register {register_update.register_name} does not exist on node {register_update.node_id}.",
                                register_update.register_name,
                                register_update.node_id,
                            )
                    except:
                        logger.exception(
                            "Failed to update register %s for %s",
                            register_update.register_name,
                            register_update.node_id,
                        )
                await asyncio.sleep(0.02)
                if not state.queues.apply_configuration.empty():
                    config = state.queues.apply_configuration.get_nowait()
                    if config.node_id and not config.is_network_config:
                        data = json.loads(config.configuration)
                        if is_configuration_simplified(data):
                            at_least_one_register_was_modified = False
                            for register_name, register_value in data.items():
                                prototype_string = state.avatar.avatars_by_node_id[
                                    int(config.node_id)
                                ].register_exploded_values.get(register_name, None)
                                if prototype_string is None:
                                    add_local_message(
                                        state,
                                        "Register %s does not exist on node %d" % (register_name, config.node_id),
                                        register_name,
                                        config.node_id,
                                    )
                                    continue
                                at_least_one_register_was_modified = True
                                prototype = unexplode_value(prototype_string)
                                unexploded_value = unexplode_value(register_value, prototype)
                                state.queues.update_registers.put(
                                    UpdateRegisterRequest(register_name, unexploded_value, config.node_id)
                                )
                            if not at_least_one_register_was_modified:
                                add_local_message(
                                    state, "No registers were modified on node %d" % config.node_id, config.node_id
                                )
                        else:
                            for potential_node_id, v in data.items():
                                if potential_node_id == "__file_name":
                                    continue
                                for register_name, value in v.items():
                                    if isinstance(value, str):
                                        logger.debug("Do something")
                                        value = json.loads(value)
                                    unexploded_value = unexplode_value(value)
                                    state.queues.update_registers.put(
                                        UpdateRegisterRequest(register_name, unexploded_value, config.node_id)
                                    )
                    elif config.is_network_config:
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
                                state.queues.update_registers.put(
                                    UpdateRegisterRequest(k, unexplode_value(v), int(node_id))
                                )
                    else:
                        raise Exception("Didn't do anything with this configuration")
                await asyncio.sleep(0.02)
                if not state.queues.reread_registers.empty():
                    request2: RereadRegistersRequest = state.queues.reread_registers.get_nowait()
                    for pair in request2.pairs:
                        if pair is None:
                            continue
                        node_id2 = int(pair)
                        register_name2 = list(request2.pairs[pair].keys())[0]
                        asyncio.create_task(get_register_value(state, node_id2, register_name2))
        except Exception as e:
            logger.exception(e)
            raise e

    asyncio.run(_internal_method())
