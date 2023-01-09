import asyncio
from atexit import register
import logging
import time

import typing

import pycyphal
from pycyphal.application.node_tracker import NodeTracker, Entry

import uavcan
from yukon.domain.avatar import Avatar
from yukon.domain.god_state import GodState

from yukon.domain.iface import Iface
from yukon.services.value_utils import _simplify_value, explode_value

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")
from uavcan.register import List_1


async def get_register_value(
    state: GodState, node_id: int, register_name: str, is_reread: typing.Optional[bool] = None
) -> typing.Any:
    current_avatar = state.avatar.avatars_by_node_id.get(node_id)
    if not current_avatar:
        logger.error("No avatar for %d", node_id)
    while not state.avatar.disappeared_nodes.get(node_id):
        service_client = state.cyphal.local_node.make_client(uavcan.register.Access_1_0, node_id)
        # service_client.response_timeout = 0.5
        msg = uavcan.register.Access_1_0.Request()
        msg.name.name = register_name
        logger.debug("Getting register value for %s", register_name)
        response = await service_client.call(msg)
        if response is not None:
            if is_reread:
                logger.debug("Received a valid response to a reread request on register %s", register_name)
            else:
                logger.debug("Got register value for %s", register_name)
            obj = response[0]
            assert isinstance(obj, uavcan.register.Access_1.Response)
            if isinstance(obj.value, uavcan.primitive.Empty_1):
                return
            assert register_name is not None
            exploded_value = explode_value(obj.value, metadata={"mutable": obj.mutable, "persistent": obj.persistent})
            current_avatar.register_exploded_values[register_name] = exploded_value
            current_avatar.register_values[register_name] = str(explode_value(obj.value, simplify=True))
            return response
        else:
            print("Failed response to register value for " + register_name)
            continue
    if state.avatar.disappeared_nodes.get(node_id):
        logger.warning("Node disappeared %d before register values could be retrieved", node_id)


async def get_register_names(
    state: GodState, node_id: int, new_avatar: Avatar, is_reread: typing.Optional[bool] = None
) -> None:
    register_values: typing.Any = {}
    counter = 0
    list_client = state.cyphal.local_node.make_client(List_1, node_id)
    if is_reread:
        logger.info("Rereading all names and values of registers of node %d", node_id)
    else:
        logger.info("Reading all names and values of registers of node %d", node_id)
    while not state.avatar.disappeared_nodes.get(node_id):
        msg = uavcan.register.List_1_0.Request(counter)
        response = await list_client.call(msg)
        if response is None:
            continue
        result: uavcan.register.List_1_0.Response = response[0]
        # I am not using the result here because it gets snooped by the avatar
        register_name = result.name.name.tobytes().decode()
        if register_name != "" and len(register_name) > 0:
            response = await get_register_value(state, node_id, register_name, is_reread)
            if response:
                obj = response[0]
                counter += 1
                register_values[register_name] = str(_simplify_value(obj.value))
        else:
            break
    if state.avatar.disappeared_nodes.get(node_id):
        logger.debug("Node %d disappeared before register names could be retrieved", node_id)
    new_avatar.register_values = register_values


def make_handler_for_node_detected(
    state: GodState, iface: Iface
) -> typing.Callable[[int, typing.Optional[Entry], typing.Optional[Entry]], None]:
    def handle_getinfo_handler_format(
        node_id: int, previous_entry: typing.Optional[Entry], next_entry: typing.Optional[Entry]
    ) -> None:
        logger.debug("Some hearbeat was probably received")
        if next_entry and next_entry.info is None:
            logger.debug("No info received")
        elif next_entry and next_entry.info is not None:
            logger.debug("A getinfo response was received")
        if previous_entry is None and next_entry is not None:
            logger.info(f"Node with id {node_id} became visible.")
            if not state.avatar.avatars_by_node_id.get(node_id):
                logger.debug("Creating new avatar")
                new_avatar = Avatar(iface, node_id=node_id, info=next_entry.info)
                state.avatar.avatars_by_node_id[node_id] = new_avatar
            state.avatar.disappeared_nodes[node_id] = False
        elif previous_entry is not None and next_entry is None:
            logger.info(f"Node with id {node_id} disappeared.")
            state.avatar.avatars_by_node_id[node_id].disappeared = True
            # Add the time of disappearance to the avatar
            state.avatar.avatars_by_node_id[node_id].disappeared_time = time.monotonic()
            state.avatar.disappeared_nodes[node_id] = True
            # del state.avatar.avatars_by_node_id[node_id]
        is_new_or_updated_entry = next_entry is not None
        if is_new_or_updated_entry:
            current_avatar = state.avatar.avatars_by_node_id[node_id]
            is_triggered_by_getinfo_request = next_entry.info is not None  # type: ignore
            if is_triggered_by_getinfo_request:
                logger.debug(f"Node with id {node_id} has info: {next_entry.info}")  # type: ignore
            else:
                getinfo_client = state.cyphal.local_node.make_client(uavcan.node.GetInfo_1_0, node_id)
                getinfo_request = uavcan.node.GetInfo_1_0.Request()
                result = asyncio.create_task(asyncio.wait_for(getinfo_client.call(getinfo_request), timeout=1))
                # I am not using the result here because it gets snooped by the avatar
                if result:
                    logger.debug(f"Node with id {node_id} has info: {result}")
                else:
                    logger.debug(f"Node with id {node_id} has no info")

                asyncio.create_task(get_register_names(state, node_id, current_avatar))

    return handle_getinfo_handler_format


def make_tracers_trackers(state: GodState) -> None:
    logger.debug("Trackers and tracers are being set up")
    state.cyphal.tracer = state.cyphal.local_node.presentation.transport.make_tracer()
    state.cyphal.tracker = NodeTracker(state.cyphal.local_node)
    iface = Iface(state.cyphal.local_node)

    state.cyphal.tracker.add_update_handler(make_handler_for_node_detected(state, iface))
