import asyncio
from atexit import register
import logging
import time

import typing

from pycyphal.application.node_tracker import NodeTracker, Entry

import uavcan
from yukon.domain.avatar import Avatar
from yukon.domain.god_state import GodState

from yukon.domain.iface import Iface
from yukon.services.snoop_registers import get_register_names

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")
from uavcan.register import List_1


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
            existing_avatar = state.avatar.avatars_by_node_id.get(node_id)
            if not existing_avatar:
                logger.debug("Creating new avatar")
                new_avatar = Avatar(iface, node_id=node_id, info=next_entry.info)
                state.avatar.avatars_by_node_id[node_id] = new_avatar
            else:
                existing_avatar.disappeared = False
                existing_avatar.disappeared_since = 0
            state.avatar.disappeared_nodes[node_id] = False
        elif previous_entry is not None and next_entry is None:
            logger.info(f"Node with id {node_id} disappeared.")
            state.avatar.avatars_by_node_id[node_id].disappeared = True
            # Add the time of disappearance to the avatar
            state.avatar.avatars_by_node_id[node_id].disappeared_since = time.monotonic()
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
