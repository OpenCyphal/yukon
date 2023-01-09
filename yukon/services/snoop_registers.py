import logging

import typing

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
