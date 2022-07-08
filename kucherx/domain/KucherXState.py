from dataclasses import dataclass, field
from typing import Optional
from pycyphal.application.node_tracker import NodeTracker

import pycyphal
from pycyphal.application import Node

from domain.CyphalLocalNodeSettings import CyphalLocalNodeSettings
from domain.NodeState import NodeState


@dataclass
class KucherXState:
    is_local_node_launched: bool
    settings: CyphalLocalNodeSettings
    local_node: Optional[Node] = None
    tracer: Optional[pycyphal.transport.Tracer] = None
    tracker: Optional[NodeTracker] = None
    known_node_states: list[NodeState] = field(default_factory=list)
