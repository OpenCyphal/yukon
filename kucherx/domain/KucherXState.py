import threading
from dataclasses import dataclass, field
from queue import Queue
from typing import Optional, Any, Callable, Dict

from networkx import DiGraph
from pycyphal.application.node_tracker import NodeTracker

import pycyphal
from pycyphal.application import Node
from pycyphal.transport.redundant import RedundantTransport

from domain.Avatar import Avatar
from domain.GraphImage import GraphImage
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
    update_monitor_image_queue: Queue[GraphImage]
    update_graph_from_avatar_queue: Queue[Avatar]
    update_image_from_graph: Queue[DiGraph]
    avatars: Dict[int, Avatar] = field(default_factory=dict)
    avatars_lock: threading.RLock = field(default_factory=threading.RLock)
    current_graph_lock: threading.RLock = field(default_factory=threading.RLock)
    current_graph: Optional[DiGraph] = None
    local_node: Optional[Node] = None
    tracer: Optional[pycyphal.transport.Tracer] = None
    tracker: Optional[NodeTracker] = None
    gui_running: bool = True
    known_node_states: list[NodeState] = field(default_factory=list)
    is_local_node_launched: bool = False
    is_close_dialog_enabled: bool = False
