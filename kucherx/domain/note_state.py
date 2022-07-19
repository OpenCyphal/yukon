# Copyright (c) 2021 OpenCyphal
# This software is distributed under the terms of the MIT License.
# Author: Pavel Kirienko <pavel@opencyphal.org>
import dataclasses
from typing import Optional

import uavcan
from domain.port_set import PortSet


@dataclasses.dataclass(frozen=True)
class NodeState:
    online: bool
    """
    Online means that the node is emitting any transfers whatsoever.
    """

    heartbeat: Optional[uavcan.node.Heartbeat_1_0]
    """
    An online node without a heartbeat is a zombie, which is an error condition because heartbeats are required
    for all nodes unconditionally.
    """
    info: Optional[uavcan.node.GetInfo_1_0.Response]

    ports: Optional[PortSet]
    """
    Defined only if the node keeps its uavcan.node.List publications up-to-date.
    """
