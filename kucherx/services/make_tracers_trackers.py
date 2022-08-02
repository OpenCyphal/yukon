import logging

import typing

import pycyphal
from pycyphal.application.node_tracker import NodeTracker, Entry

from kucherx.domain.avatar import Avatar
from kucherx.domain.god_state import GodState

from kucherx.domain.iface import Iface

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")


def make_handler_for_node_detected(
    state: GodState, iface: Iface, avatars: typing.Dict[int, Avatar]
) -> typing.Callable[[int, typing.Optional[Entry], typing.Optional[Entry]], None]:
    def handle_getinfo_handler_format(
        node_id: int, previous_entry: typing.Optional[Entry], next_entry: typing.Optional[Entry]
    ) -> None:
        print("Some getinfo entry was received")
        if previous_entry is None:
            print(f"Node with id {node_id} became visible.")
            avatars[node_id] = Avatar(iface, node_id=node_id)
            state.queues.graph_from_avatar.put(avatars[node_id])

    return handle_getinfo_handler_format


def make_tracers_trackers(state: GodState) -> None:
    print("Trackers and tracers are being set up")
    state.cyphal.tracer = state.cyphal.local_node.presentation.transport.make_tracer()
    state.cyphal.tracker = NodeTracker(state.cyphal.local_node)
    iface = Iface(state.cyphal.local_node)

    state.cyphal.tracker.add_update_handler(make_handler_for_node_detected(state, iface, state.avatar.avatars))
