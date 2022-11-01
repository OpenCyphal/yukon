import typing
import uavcan
from _typeshed import Incomplete
from atexit import register as register
from pycyphal.transport import AlienTransfer as AlienTransfer, Timestamp as Timestamp
from typing import Any, Optional
from yukon.domain.interfaces.iface import Iface as Iface
from yukon.domain.interfaces.node_state import NodeState

logger: Incomplete


class Avatar:
    register_values: Incomplete
    register_exploded_values: Incomplete
    access_requests_names_by_transfer_id: Incomplete

    def __init__(self, iface: Iface, node_id: int, info: Optional[uavcan.node.GetInfo_1_0.Response] = ...,
                 previous_port_list_hash: Optional[int] = ...) -> None: ...

    @property
    def node_id(self) -> int: ...

    def is_node_online(self, ts: float) -> typing.Any: ...

    def update(self, ts: float) -> NodeState: ...

    def to_builtin(self) -> Any: ...

    def __hash__(self) -> int: ...
