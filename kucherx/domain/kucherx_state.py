import threading
import typing
from dataclasses import dataclass, field
from queue import Queue
from typing import Optional, Any, Callable, Dict

from networkx import DiGraph
from pycyphal.application.node_tracker import NodeTracker

import pycyphal
from pycyphal.application import Node
from pycyphal.transport.redundant import RedundantTransport

from domain.avatar import Avatar
from domain.graph_image import GraphImage
from domain.interface import Interface
from domain.note_state import NodeState


@dataclass(init=False)
class KucherXState:
    def __init__(self):
        self.avatars = {}
        self.update_monitor_image_queue = Queue()
        self.update_image_from_graph = Queue()
        self.update_graph_from_avatar_queue = Queue()
        self.avatars_lock = threading.RLock()
        self.current_graph_lock = threading.RLock()

    interfaces: list[Interface]
    event_loop: Any
    add_transport: Callable[[Interface], None]
    pseudo_transport: Optional[RedundantTransport]
    update_monitor_image_queue: Queue[GraphImage]
    update_graph_from_avatar_queue: Queue[Avatar]
    update_image_from_graph: Queue[DiGraph]
    avatars: Dict[int, Avatar]
    avatars_lock: threading.RLock
    current_graph_lock: threading.RLock
    current_requested_image_size: typing.Tuple[int, int] = field(default_factory=lambda: (600, 600))
    current_graph: Optional[DiGraph] = None
    local_node: Optional[Node] = None
    tracer: Optional[pycyphal.transport.Tracer] = None
    tracker: Optional[NodeTracker] = None
    gui_running: bool = True
    known_node_states: list[NodeState] = field(default_factory=list)
    is_local_node_launched: bool = False
    is_close_dialog_enabled: bool = False
