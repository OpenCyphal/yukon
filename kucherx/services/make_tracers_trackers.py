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

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")


def make_handler_for_node_detected(
    state: GodState, iface: Iface
) -> typing.Callable[[int, typing.Optional[Entry], typing.Optional[Entry]], None]:
    def handle_getinfo_handler_format(
        node_id: int, previous_entry: typing.Optional[Entry], next_entry: typing.Optional[Entry]
    ) -> None:
        print("Some hearbeat was probably received")
        if next_entry and next_entry.info is None:
            print("No info received")
        elif next_entry and next_entry.info is not None:
            print("A getinfo response was received")
        if previous_entry is None and next_entry is not None:
            print(f"Node with id {node_id} became visible.")
            new_avatar = Avatar(iface, node_id=node_id, info=next_entry.info)
            state.avatar.avatars_by_node_id[node_id] = new_avatar
        elif previous_entry is not None and next_entry is None:
            print(f"Node with id {node_id} disappeared.")
            del state.avatar.avatars_by_node_id[node_id]
        if next_entry is not None:
            if next_entry.info is not None:
                print(f"Node with id {node_id} has info: {next_entry.info}")
            else:
                getinfo_client = state.cyphal.local_node.make_client(uavcan.node.GetInfo_1_0, node_id)
                getinfo_request = uavcan.node.GetInfo_1_0.Request()
                result = asyncio.create_task(asyncio.wait_for(getinfo_client.call(getinfo_request), timeout=1))
                if result:
                    print(f"Node with id {node_id} has info: {result}")
                else:
                    print(f"Node with id {node_id} has no info")

    return handle_getinfo_handler_format


def make_tracers_trackers(state: GodState) -> None:
    print("Trackers and tracers are being set up")
    state.cyphal.tracer = state.cyphal.local_node.presentation.transport.make_tracer()
    state.cyphal.tracker = NodeTracker(state.cyphal.local_node)
    iface = Iface(state.cyphal.local_node)

    state.cyphal.tracker.add_update_handler(make_handler_for_node_detected(state, iface))
