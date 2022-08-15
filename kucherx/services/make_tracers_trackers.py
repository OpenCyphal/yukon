import asyncio
import logging
import time

import typing

import pycyphal
from pycyphal.application.node_tracker import NodeTracker, Entry

import uavcan
from kucherx.domain.avatar import Avatar
from kucherx.domain.god_state import GodState

from kucherx.domain.iface import Iface
from kucherx.services.value_utils import _simplify_value

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")
from uavcan.register import List_1


def make_handler_for_node_detected(
    state: GodState, iface: Iface
) -> typing.Callable[[int, typing.Optional[Entry], typing.Optional[Entry]], None]:
    def handle_getinfo_handler_format(
        node_id: int, previous_entry: typing.Optional[Entry], next_entry: typing.Optional[Entry]
    ) -> None:
        logger.info("Some hearbeat was probably received")
        if next_entry and next_entry.info is None:
            logger.info("No info received")
        elif next_entry and next_entry.info is not None:
            logger.info("A getinfo response was received")
        if previous_entry is None and next_entry is not None:
            logger.info(f"Node with id {node_id} became visible.")
            new_avatar = Avatar(iface, node_id=node_id, info=next_entry.info)
            state.avatar.avatars_by_node_id[node_id] = new_avatar
        elif previous_entry is not None and next_entry is None:
            logger.info(f"Node with id {node_id} disappeared.")
            del state.avatar.avatars_by_node_id[node_id]
        is_new_or_updated_entry = next_entry is not None
        if is_new_or_updated_entry:
            current_avatar = state.avatar.avatars_by_node_id[node_id]
            is_triggered_by_getinfo_request = next_entry.info is not None  # type: ignore
            if is_triggered_by_getinfo_request:
                logger.info(f"Node with id {node_id} has info: {next_entry.info}")  # type: ignore
            else:
                getinfo_client = state.cyphal.local_node.make_client(uavcan.node.GetInfo_1_0, node_id)
                getinfo_request = uavcan.node.GetInfo_1_0.Request()
                result = asyncio.create_task(asyncio.wait_for(getinfo_client.call(getinfo_request), timeout=1))
                # I am not using the result here because it gets snooped by the avatar
                if result:
                    logger.info(f"Node with id {node_id} has info: {result}")
                else:
                    logger.info(f"Node with id {node_id} has no info")

                async def get_register_value(register_name: str) -> typing.Any:
                    service_client = state.cyphal.local_node.make_client(uavcan.register.Access_1_0, node_id)
                    service_client.response_timeout = 0.5
                    msg = uavcan.register.Access_1_0.Request()
                    msg.name.name = register_name
                    return await service_client.call(msg)

                async def get_register_names() -> None:
                    register_values: typing.Any = {}
                    counter = 0
                    list_client = state.cyphal.local_node.make_client(List_1, node_id)
                    while True:
                        msg = uavcan.register.List_1_0.Request(counter)
                        result: uavcan.register.List_1_0.Response = (await list_client.call(msg))[0]
                        # I am not using the result here because it gets snooped by the avatar
                        register_name = result.name.name.tobytes().decode()
                        if register_name != "" and len(register_name) > 1:
                            response = await get_register_value(register_name)
                            if response:
                                obj = response[0]
                                counter += 1
                                if register_name == "uavcan.node.unique_id":
                                    unstructured_value = obj.value.unstructured
                                    array = bytearray(unstructured_value.value)
                                    # Convert to hex string
                                    hex_string = array.hex(":")
                                    register_values[register_name] = hex_string
                                    await asyncio.sleep(0.02)
                                    continue
                                register_values[register_name] = str(_simplify_value(obj.value))
                        else:
                            break
                    new_avatar.register_values = register_values

                asyncio.create_task(get_register_names())

    return handle_getinfo_handler_format


def make_tracers_trackers(state: GodState) -> None:
    print("Trackers and tracers are being set up")
    state.cyphal.tracer = state.cyphal.local_node.presentation.transport.make_tracer()
    state.cyphal.tracker = NodeTracker(state.cyphal.local_node)
    iface = Iface(state.cyphal.local_node)

    state.cyphal.tracker.add_update_handler(make_handler_for_node_detected(state, iface))
