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

from kucherx.domain.allocation_request import AllocationRequest
from kucherx.domain.HWID import HWID
from kucherx.domain import allocation_request
from kucherx.domain.attach_transport_request import AttachTransportRequest
from kucherx.domain.UID import UID
from kucherx.domain.avatar import Avatar
from kucherx.domain.graph_image import GraphImage
from kucherx.domain.interface import Interface
from kucherx.domain.note_state import NodeState

logger = logging.getLogger(__name__)


def none_factory() -> None:
    return None


@dataclass
class QueuesState:
    """A class that holds all queues used by the god state."""
    graph_from_avatar: Queue[Avatar] = field(default_factory=Queue)
    image_from_graph: Queue[DiGraph] = field(default_factory=Queue)
    next_monitor_images: Queue[GraphImage] = field(default_factory=Queue)
    messages: Queue[str] = field(default_factory=Queue)
    attach_transport_response: Queue[str] = field(default_factory=Queue)
    attach_transport: Queue[AttachTransportRequest] = field(default_factory=Queue)
    detach_transport: Queue[AttachTransportRequest] = field(default_factory=Queue)


@dataclass
class GuiState:
    """A class that holds all GUI references used by the god state."""

    dpg: Any = field(default_factory=none_factory)
    event_loop: Any = field(default_factory=none_factory)
    interfaces: list[Interface] = field(default_factory=list)
    transports_of_windows: typing.Dict[UID, pycyphal.transport.Transport] = field(default_factory=dict)
    requested_monitor_image_size: typing.Tuple[int, int] = (600, 600)
    pixel_in_inches: float = 0.0
    gui_running: bool = True
    is_local_node_launched: bool = False
    save_dialog_open: bool = False
    display_errors_callback: typing.Optional[typing.Callable[[str], None]] = field(default_factory=none_factory)
    main_screen_table_uid: Optional[UID] = field(default_factory=none_factory)
    second_row: Optional[UID] = field(default_factory=none_factory)
    default_font: Optional[UID] = field(default_factory=none_factory)
    theme: Optional[UID] = field(default_factory=none_factory)
    allocations_window: Optional[UID] = field(default_factory=none_factory)
    is_close_dialog_enabled: bool = False


@dataclass
class AllocationState:
    allocation_requests_by_hwid: Dict[HWID, AllocationRequest] = field(default_factory=dict)
    allocated_nodes: Dict[HWID, Node] = field(default_factory=dict)


@dataclass
class CyphalState:
    """A class that holds all cyphal references used by the god state."""
    pseudo_transport: Optional[RedundantTransport] = field(default_factory=none_factory)
    tracer: Optional[pycyphal.transport.Tracer] = field(default_factory=none_factory)
    tracker: Optional[NodeTracker] = field(default_factory=none_factory)
    local_node: Optional[Node] = field(default_factory=none_factory)
    add_transport: Optional[Callable[[Interface], None]] = field(default_factory=none_factory)
    known_node_states: list[NodeState] = field(default_factory=list)
    allocation_subscriber: Optional[pycyphal.presentation.Subscriber] = field(default_factory=none_factory)


@dataclass
class AvatarState:
    avatars_by_node_id: Dict[int, Avatar] = field(default_factory=dict)
    avatars_by_hw_id: Dict[int, Avatar] = field(default_factory=dict)
    avatars_lock: threading.RLock = field(default_factory=threading.RLock)
    current_graph_lock: threading.RLock = field(default_factory=threading.RLock)
    current_requested_image_size: typing.Tuple[int, int] = field(default_factory=lambda: (600, 600))
    current_graph: Optional[DiGraph] = field(default_factory=none_factory)


class GodState:
    def __init__(self) -> None:
        self.queues = QueuesState()
        self.gui = GuiState()
        self.cyphal = CyphalState()
        self.avatar = AvatarState()
        self.allocation = AllocationState()
