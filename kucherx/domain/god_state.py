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

from kucherx.domain.attach_transport_request import AttachTransportRequest
from kucherx.domain.UID import UID
from kucherx.domain.avatar import Avatar
from kucherx.domain.graph_image import GraphImage
from kucherx.domain.interface import Interface
from kucherx.domain.note_state import NodeState

logger = logging.getLogger(__name__)


class EmptyField:
    def __init__(self, *args, **kwargs):
        pass

    def __repr__(self):
        return 'EmptyField()'


@dataclass
class QueuesState:
    """A class that holds all queues used by the god state."""
    graph_from_avatar: Queue[Avatar] = field(default_factory=Queue)
    image_from_graph: Queue[DiGraph] = field(default_factory=Queue)
    next_monitor_images: Queue[GraphImage] = field(default_factory=Queue)
    messages: Queue[str] = field(default_factory=Queue)
    interface_successfully_added_messages: Queue[str] = field(default_factory=Queue)
    add_transport: Queue[AttachTransportRequest] = field(default_factory=Queue)
    detach_transports: Queue[AttachTransportRequest] = field(default_factory=Queue)


@dataclass
class GuiState:
    """A class that holds all GUI references used by the god state."""
    dpg: Any = field(default_factory=EmptyField)
    event_loop: Any = field(default_factory=EmptyField)
    interfaces: list[Interface] = field(default_factory=list)
    transports_of_windows: typing.Dict[UID, pycyphal.transport.Transport] = field(default_factory=dict)
    requested_monitor_image_size: typing.Tuple[int, int] = (600, 600)
    pixel_in_inches: float = 0.0
    gui_running: bool = True
    is_local_node_launched: bool = False
    is_close_dialog_enabled: bool = True
    save_dialog_open: bool = False
    display_errors_callback: typing.Optional[typing.Callable[[str], None]] = field(default_factory=EmptyField)
    main_screen_table_uid: Optional[UID] = field(default_factory=EmptyField)
    second_row: Optional[UID] = field(default_factory=EmptyField)
    default_font: Optional[UID] = field(default_factory=EmptyField)
    theme: Optional[UID] = field(default_factory=EmptyField)


@dataclass
class CyphalState:
    """A class that holds all cyphal references used by the god state."""

    pseudo_transport: Optional[RedundantTransport] = field(default_factory=EmptyField)
    tracer: Optional[pycyphal.transport.Tracer] = field(default_factory=EmptyField)
    tracker: Optional[NodeTracker] = field(default_factory=EmptyField)
    local_node: Optional[Node] = field(default_factory=EmptyField)
    add_transport: Optional[Callable[[Interface], None]] = field(default_factory=EmptyField)
    known_node_states: list[NodeState] = field(default_factory=list)


@dataclass
class AvatarState:
    avatars: Dict[int, Avatar] = field(default_factory=dict)
    avatars_lock: threading.RLock = field(default_factory=threading.RLock)
    current_graph_lock: threading.RLock = field(default_factory=threading.RLock)
    current_requested_image_size: typing.Tuple[int, int] = field(default_factory=lambda: (600, 600))
    current_graph: Optional[DiGraph] = field(default_factory=EmptyField)


class GodState:
    def __init__(self):
        self.queues = QueuesState()
        self.gui = GuiState()
        self.cyphal = CyphalState()
        self.avatar = AvatarState()
