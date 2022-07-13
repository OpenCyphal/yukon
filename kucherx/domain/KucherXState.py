from dataclasses import dataclass, field
from queue import Queue
from typing import Optional, Any, Callable
from pycyphal.application.node_tracker import NodeTracker

import pycyphal
from pycyphal.application import Node
from pycyphal.transport.redundant import RedundantTransport

from domain.Interface import Interface
from domain.NodeState import NodeState


@dataclass(init=False)
class KucherXState:
    def __init__(self):
        pass
    interfaces: list[Interface]
    event_loop: Any
    add_transport: Callable[[Interface], None]
    pseudo_transport: Optional[RedundantTransport]
    local_node: Optional[Node] = None
    tracer: Optional[pycyphal.transport.Tracer] = None
    tracker: Optional[NodeTracker] = None
    gui_running: bool = True
    known_node_states: list[NodeState] = field(default_factory=list)
    is_local_node_launched: bool = False
    is_close_dialog_enabled: bool = False
