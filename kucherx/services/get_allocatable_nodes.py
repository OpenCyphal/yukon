import datetime
import typing

import pycyphal.transport

import uavcan
import uavcan.pnp.NodeIDAllocationData_2_0

from kucherx.domain.god_state import GodState


def _on_allocation_data(state, msg: uavcan.pnp.NodeIDAllocationData_1_0,
                        transfer_from: pycyphal.transport.TransferFrom):
    print("Received allocation data")


def get_allocatable_nodes(state: GodState) -> typing.List[int]:
    state.cyphal.allocation_subscriber = state.cyphal.local_node.make_subscriber(uavcan.pnp.NodeIDAllocationData_1_0)
    state.cyphal.allocation_subscriber.receive_in_background(
        lambda msg, transfer_from: _on_allocation_data(state, msg, transfer_from))
