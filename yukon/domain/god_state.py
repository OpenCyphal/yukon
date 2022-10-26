import logging
import threading
import typing
from dataclasses import dataclass, field
from pathlib import Path
from queue import Queue
from typing import Optional, Any, Callable, Dict
from uuid import UUID

from pycyphal.application.node_tracker import NodeTracker

import pycyphal
from pycyphal.application import Node
from pycyphal.transport.redundant import RedundantTransport

from yukon.domain.subscribe_request import SubscribeRequest
from yukon.domain.update_register_log_item import UpdateRegisterLogItem
from yukon.domain.reread_registers_request import RereadRegistersRequest
from yukon.domain.apply_configuration_request import ApplyConfigurationRequest
from yukon.domain.message import Message
from yukon.domain.allocation_request import AllocationRequest
from yukon.domain.HWID import HWID
from yukon.domain.attach_transport_request import AttachTransportRequest
from yukon.domain.UID import UID
from yukon.domain.avatar import Avatar
from yukon.domain.interface import Interface
from yukon.domain.note_state import NodeState
from yukon.domain.update_register_request import UpdateRegisterRequest
from yukon.domain.update_register_response import UpdateRegisterResponse
from yukon.services.faulty_transport import FaultyTransport
from yukon.domain.command_send_request import CommandSendRequest
from yukon.domain.command_send_response import CommandSendResponse
from yukon.domain.reread_register_names_request import RereadRegisterNamesRequest

logger = logging.getLogger(__name__)


def none_factory() -> None:
    return None


@dataclass
class QueuesState:
    """
    A class that holds all queues used by the god state.

    Queues exist because operations with Pycyphal can only be performed from its own thread.

    Some responses are put in dictionaries with the request id as key. This is more appropriate
    when compared to each client of a queue having to search through the queue by popping and
    later reinserting requests that didn't have a matching id.

    """

    message_queue_counter: int = 0
    messages: Queue[Message] = field(default_factory=Queue)
    attach_transport_response: Queue[str] = field(default_factory=Queue)
    attach_transport: Queue[AttachTransportRequest] = field(default_factory=Queue)
    detach_transport: Queue[int] = field(default_factory=Queue)
    update_registers: Queue[UpdateRegisterRequest] = field(default_factory=Queue)
    update_registers_response: Dict[UUID, UpdateRegisterResponse] = field(default_factory=dict)
    subscribe_requests: Queue[SubscribeRequest] = field(default_factory=Queue)
    subscribe_requests_responses: Queue[str] = field(default_factory=Queue)
    unsubscribe_requests: Queue[int] = field(default_factory=Queue)
    unsubscribe_requests_responses: Queue[str] = field(default_factory=Queue)
    apply_configuration: Queue[ApplyConfigurationRequest] = field(default_factory=Queue)
    reread_registers: Queue[RereadRegistersRequest] = field(default_factory=Queue)
    reread_register_names: Queue[RereadRegisterNamesRequest] = field(default_factory=Queue)
    detach_transport_response: Queue[str] = field(default_factory=Queue)
    send_command: Queue[CommandSendRequest] = field(default_factory=Queue)
    command_response: Queue[CommandSendResponse] = field(default_factory=Queue)


@dataclass
class GuiState:
    """A class that holds all GUI references used by the god state."""

    gui_running: bool = True
    last_poll_received: float = 0.0
    time_allowed_between_polls: float = 6.5
    message_severity: str = "DEBUG"
    server_port: int = 5000
    is_port_decided: bool = False
    forced_port: Optional[int] = None
    is_headless: bool = False
    is_running_in_browser: bool = False
    is_target_client_known: bool = False


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
    transports_list: typing.List[Interface] = field(default_factory=list)
    inferior_transports_by_interface_hashes: Dict[int, Interface] = field(default_factory=dict)
    already_used_transport_interfaces: Dict[str, int] = field(default_factory=dict)
    faulty_transport: Optional[FaultyTransport] = field(default_factory=none_factory)
    register_update_log: typing.List[UpdateRegisterLogItem] = field(default_factory=list)
    subscribers_by_subscribe_request: Dict[SubscribeRequest, pycyphal.presentation.Subscriber] = field(
        default_factory=dict
    )


@dataclass
class AvatarState:
    hide_yakut_avatar: bool = False
    avatars_by_node_id: Dict[int, Avatar] = field(default_factory=dict)
    avatars_by_hw_id: Dict[int, Avatar] = field(default_factory=dict)
    avatars_lock: threading.RLock = field(default_factory=threading.RLock)
    current_graph_lock: threading.RLock = field(default_factory=threading.RLock)
    disappeared_nodes: Dict[int, bool] = field(default_factory=dict)


class GodState:
    def __init__(self) -> None:
        self.queues = QueuesState()
        self.gui = GuiState()
        self.cyphal = CyphalState()
        self.avatar = AvatarState()
        self.allocation = AllocationState()
        self.api = None
