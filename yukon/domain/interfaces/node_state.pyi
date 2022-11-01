import uavcan
from typing import Optional
from uavcan import node as node
from yukon.domain.interfaces.port_set import PortSet as PortSet


class NodeState:
    online: bool
    heartbeat: Optional[uavcan.node.Heartbeat_1_0]
    info: Optional[uavcan.node.GetInfo_1_0.Response]
    ports: Optional[PortSet]

    def __init__(self, online, heartbeat, info, ports) -> None: ...
