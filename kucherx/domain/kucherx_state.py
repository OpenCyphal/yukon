import logging
import threading
import typing
from dataclasses import dataclass, field
from pathlib import Path
from queue import Queue
from typing import Optional, Any, Callable, Dict

from networkx import DiGraph
from pycyphal.application.node_tracker import NodeTracker

import pycyphal
from pycyphal.application import Node
from pycyphal.transport.can import CANTransport
from pycyphal.transport.redundant import RedundantTransport

from kucherx.domain.UID import UID
from kucherx.domain.avatar import Avatar
from kucherx.domain.graph_image import GraphImage
from kucherx.domain.interface import Interface
from kucherx.domain.note_state import NodeState

logger = logging.getLogger(__name__)


@dataclass(init=False)
class KucherXState:
    def __init__(self) -> None:
        self.avatars = {}
        self.update_monitor_image_queue = Queue()
        self.update_image_from_graph = Queue()
        self.update_graph_from_avatar_queue = Queue()
        self.avatars_lock = threading.RLock()
        self.current_graph_lock = threading.RLock()
        self.current_requested_image_size = (600, 600)
        self.queue_add_transports = Queue()
        self.queue_detach_transports = Queue()
        self.errors_queue = Queue()
        self.default_font = None
        self.theme = None
        self.display_errors_callback = lambda message: logger.error(message)

    interfaces: list[Interface]
    default_font: Optional[UID]
    theme: Optional[UID]
    event_loop: Any
    display_errors_callback: typing.Callable[[str], None]
    add_transport: Callable[[Interface], None]
    pseudo_transport: Optional[RedundantTransport]
    update_monitor_image_queue: Queue[GraphImage]
    update_graph_from_avatar_queue: Queue[Avatar]
    update_image_from_graph: Queue[DiGraph]
    errors_queue: Queue[str]
    transports_of_windows: typing.Dict[UID, pycyphal.transport.Transport]
    queue_add_transports: Queue
    queue_detach_transports: Queue
    avatars: Dict[int, Avatar]
    avatars_lock: threading.RLock
    current_graph_lock: threading.RLock
    current_requested_image_size: typing.Tuple[int, int]
    current_graph: Optional[DiGraph] = None
    local_node: Optional[Node] = None
    tracer: Optional[pycyphal.transport.Tracer] = None
    tracker: Optional[NodeTracker] = None
    gui_running: bool = True
    known_node_states: list[NodeState] = field(default_factory=list)
    is_local_node_launched: bool = False
    is_close_dialog_enabled: bool = False
