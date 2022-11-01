import pycyphal
import threading
import typing
from _typeshed import Incomplete
from pathlib import Path as Path
from pycyphal.application import Node as Node
from pycyphal.application.node_tracker import NodeTracker as NodeTracker
from pycyphal.transport.redundant import RedundantTransport as RedundantTransport
from queue import Queue
from services.messages_publisher import MessagesPublisher as MessagesPublisher
from typing import Callable, Dict, Optional
from uuid import UUID
from yukon.domain.interfaces.HWID import HWID as HWID
from yukon.domain.interfaces.UID import UID as UID
from yukon.domain.interfaces.allocation_request import AllocationRequest as AllocationRequest
from yukon.domain.interfaces.apply_configuration_request import ApplyConfigurationRequest as ApplyConfigurationRequest
from yukon.domain.interfaces.attach_transport_request import AttachTransportRequest as AttachTransportRequest
from yukon.domain.interfaces.avatar import Avatar as Avatar
from yukon.domain.interfaces.command_send_request import CommandSendRequest as CommandSendRequest
from yukon.domain.interfaces.command_send_response import CommandSendResponse as CommandSendResponse
from yukon.domain.interfaces.interface import Interface as Interface
from yukon.domain.interfaces.message import Message as Message
from yukon.domain.interfaces.messages_store import MessagesStore as MessagesStore
from yukon.domain.interfaces.node_state import NodeState as NodeState
from yukon.domain.interfaces.reread_register_names_request import \
    RereadRegisterNamesRequest as RereadRegisterNamesRequest
from yukon.domain.interfaces.reread_registers_request import RereadRegistersRequest as RereadRegistersRequest
from yukon.domain.interfaces.subject_specifier import SubjectSpecifier as SubjectSpecifier
from yukon.domain.interfaces.subscribe_request import SubscribeRequest as SubscribeRequest
from yukon.domain.interfaces.subscribe_response import SubscribeResponse as SubscribeResponse
from yukon.domain.interfaces.update_register_log_item import UpdateRegisterLogItem as UpdateRegisterLogItem
from yukon.domain.interfaces.update_register_request import UpdateRegisterRequest as UpdateRegisterRequest
from yukon.domain.interfaces.update_register_response import UpdateRegisterResponse as UpdateRegisterResponse
from yukon.services.faulty_transport import FaultyTransport as FaultyTransport

logger: Incomplete


def none_factory() -> None: ...


class QueuesState:
    message_queue_counter: int
    messages: Queue[Message]
    attach_transport_response: Queue[str]
    attach_transport: Queue[AttachTransportRequest]
    detach_transport: Queue[int]
    update_registers: Queue[UpdateRegisterRequest]
    update_registers_response: Dict[UUID, UpdateRegisterResponse]
    subscribe_requests: Queue[SubscribeRequest]
    subscribe_requests_responses: Queue[SubscribeResponse]
    subscribed_messages: typing.Dict[SubjectSpecifier, MessagesStore]
    unsubscribe_requests: Queue[int]
    unsubscribe_requests_responses: Queue[str]
    apply_configuration: Queue[ApplyConfigurationRequest]
    reread_registers: Queue[RereadRegistersRequest]
    reread_register_names: Queue[RereadRegisterNamesRequest]
    detach_transport_response: Queue[str]
    send_command: Queue[CommandSendRequest]
    command_response: Queue[CommandSendResponse]

    def __init__(self, message_queue_counter, messages, attach_transport_response, attach_transport, detach_transport,
                 update_registers, update_registers_response, subscribe_requests, subscribe_requests_responses,
                 subscribed_messages, unsubscribe_requests, unsubscribe_requests_responses, apply_configuration,
                 reread_registers, reread_register_names, detach_transport_response, send_command,
                 command_response) -> None: ...


class GuiState:
    gui_running: bool
    last_poll_received: float
    time_allowed_between_polls: float
    message_severity: str
    server_port: int
    is_port_decided: bool
    forced_port: Optional[int]
    is_headless: bool
    is_running_in_browser: bool
    is_target_client_known: bool

    def __init__(self, gui_running, last_poll_received, time_allowed_between_polls, message_severity, server_port,
                 is_port_decided, forced_port, is_headless, is_running_in_browser, is_target_client_known) -> None: ...


class AllocationState:
    allocation_requests_by_hwid: Dict[HWID, AllocationRequest]
    allocated_nodes: Dict[HWID, Node]

    def __init__(self, allocation_requests_by_hwid, allocated_nodes) -> None: ...


class CyphalState:
    pseudo_transport: Optional[RedundantTransport]
    tracer: Optional[pycyphal.transport.Tracer]
    tracker: Optional[NodeTracker]
    local_node: Optional[Node]
    add_transport: Optional[Callable[[Interface], None]]
    known_node_states: list[NodeState]
    allocation_subscriber: Optional[pycyphal.presentation.Subscriber]
    transports_list: typing.List[Interface]
    inferior_transports_by_interface_hashes: Dict[int, Interface]
    already_used_transport_interfaces: Dict[str, int]
    faulty_transport: Optional[FaultyTransport]
    register_update_log: typing.List[UpdateRegisterLogItem]
    subscribers_by_subscribe_request: Dict[SubscribeRequest, pycyphal.presentation.Subscriber]

    def __init__(self, pseudo_transport, tracer, tracker, local_node, add_transport, known_node_states,
                 allocation_subscriber, transports_list, inferior_transports_by_interface_hashes,
                 already_used_transport_interfaces, faulty_transport, register_update_log,
                 subscribers_by_subscribe_request) -> None: ...


class AvatarState:
    hide_yakut_avatar: bool
    avatars_by_node_id: Dict[int, Avatar]
    avatars_by_hw_id: Dict[int, Avatar]
    avatars_lock: threading.RLock
    current_graph_lock: threading.RLock
    disappeared_nodes: Dict[int, bool]

    def __init__(self, hide_yakut_avatar, avatars_by_node_id, avatars_by_hw_id, avatars_lock, current_graph_lock,
                 disappeared_nodes) -> None: ...


class GodState:
    queues: Incomplete
    gui: Incomplete
    cyphal: Incomplete
    avatar: Incomplete
    allocation: Incomplete
    settings: Incomplete
    messages_publisher: Incomplete
    api: Incomplete

    def __init__(self) -> None: ...
