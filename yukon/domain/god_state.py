import logging
from pathlib import Path
import threading
import typing
from dataclasses import dataclass, field
from queue import Queue
from asyncio import Queue as AsyncQueue
from typing import Optional, Any, Callable, Dict
from uuid import UUID

import dronecan
import pycyphal
from dronecan.node import Node
import dronecan.app
from yukon.domain.publisher import YukonPublisher
import yukon.services.FileServer
from yukon.domain.reactive_value_objects import ReactiveValue
from yukon.domain.dronecan_traffic_queues import DroneCanTrafficQueues
from yukon.domain.subscriptions.synchronized_subjects_specifier import SynchronizedSubjectsSpecifier
from yukon.domain.subscriptions.synchronized_message_store import SynchronizedMessageStore

from yukon.services.FileServer import FileServer
from yukon.services.CentralizedAllocator import CentralizedAllocator
from yukon.services.messages_publisher import MessagesPublisher
from yukon.domain.subscriptions.messages_store import MessagesStore
from yukon.domain.subject_specifier import SubjectSpecifier
from yukon.domain.subscriptions.subscribe_response import SubscribeResponse
from yukon.domain.subscriptions.subscribe_request import SubscribeRequest
from yukon.domain.registers.update_register_log_item import UpdateRegisterLogItem
from yukon.domain.registers.reread_registers_request import RereadRegistersRequest
from yukon.domain.registers.apply_configuration_request import ApplyConfigurationRequest
from yukon.domain.message import Message
from yukon.domain.allocation_request import AllocationRequest
from yukon.domain.HWID import HWID
from yukon.domain.avatar import Avatar
from yukon.domain.interface import Interface
from yukon.domain.node_state import NodeState
from yukon.domain.registers.update_register_response import UpdateRegisterResponse
from yukon.services.faulty_transport import FaultyTransport
from yukon.domain.command_send_request import CommandSendRequest
from yukon.domain.command_send_response import CommandSendResponse
from yukon.domain.registers.reread_register_names_request import RereadRegisterNamesRequest

from yukon.domain.transport.attach_transport_response import AttachTransportResponse

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
    attach_transport_response: Queue[AttachTransportResponse] = field(default_factory=Queue)
    update_registers_response: Dict[UUID, UpdateRegisterResponse] = field(default_factory=dict)
    subscribe_requests_responses: Queue[SubscribeResponse] = field(default_factory=Queue)
    unsubscribe_requests_responses: Queue[str] = field(default_factory=Queue)
    reread_register_names: Queue[RereadRegisterNamesRequest] = field(default_factory=Queue)
    detach_transport_response: Queue[str] = field(default_factory=Queue)
    command_response: Queue[CommandSendResponse] = field(default_factory=Queue)
    god_queue: AsyncQueue[Any] = field(default_factory=AsyncQueue)


@dataclass
class GuiState:
    """A class that holds all GUI references used by the god state."""

    # This gui_running is actually an application wide flag that is used to stop the application
    gui_running: bool = True
    last_poll_received: float = 0.0
    time_allowed_between_polls: float = 6.5
    # logging level / log level / message severity
    message_severity: str = "DEBUG"
    server_port: int = 5000
    is_port_decided: bool = False
    forced_port: Optional[int] = None
    is_headless: bool = False
    is_running_in_browser: bool = False
    is_target_client_known: bool = False
    # Basically if this is a production environment or a development run
    is_built_executable: bool = False


@dataclass
class AllocationState:
    allocation_requests_by_hwid: Dict[HWID, AllocationRequest] = field(default_factory=dict)
    allocated_nodes: Dict[HWID, "pycyphal.application.Node"] = field(default_factory=dict)


@dataclass
class CyphalState:
    """A class that holds all cyphal references used by the god state."""

    pseudo_transport: Optional["pycyphal.transport.redundant.RedundantTransport"] = field(default_factory=none_factory)
    tracer: Optional[pycyphal.transport.Tracer] = field(default_factory=none_factory)
    tracker: Optional["pycyphal.application.node_tracker.NodeTracker"] = field(default_factory=none_factory)
    local_node: Optional["pycyphal.application.Node"] = field(default_factory=none_factory)
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
    synchronized_message_stores: Dict[SynchronizedSubjectsSpecifier, SynchronizedMessageStore] = field(
        default_factory=dict
    )
    synchronizers_by_specifier: Dict[
        SynchronizedSubjectsSpecifier, "pycyphal.presentation.subscription_synchronizer.Synchronizer"
    ] = field(default_factory=dict)
    publishers_by_id: Dict[UUID, YukonPublisher] = field(default_factory=dict)
    message_stores_by_specifier: typing.Dict[SubjectSpecifier, MessagesStore] = field(default_factory=dict)
    centralized_allocator: Optional[CentralizedAllocator] = field(default_factory=none_factory)
    file_server: Optional[yukon.services.FileServer.FileServer] = field(default_factory=none_factory)


@dataclass
class AvatarState:
    hide_yakut_avatar: bool = False
    avatars_by_node_id: Dict[int, Avatar] = field(default_factory=dict)
    avatars_by_hw_id: Dict[int, Avatar] = field(default_factory=dict)
    avatars_lock: threading.RLock = field(default_factory=threading.RLock)
    current_graph_lock: threading.RLock = field(default_factory=threading.RLock)
    disappeared_nodes: Dict[int, bool] = field(default_factory=dict)


@dataclass
class DroneCanState:
    driver: Optional["yukon.services.flash_dronecan_firmware_with_cyphal_firmware.GoodDriver"] = field(
        default_factory=none_factory
    )
    all_entries: Dict[int, "yukon.services.mydronecan.node_monitor.NodeMonitor.Entry"] = field(default_factory=dict)
    enabled: ReactiveValue = ReactiveValue(True)
    firmware_update_enabled: ReactiveValue = ReactiveValue(True)
    firmware_update_path: ReactiveValue = ReactiveValue("")
    is_running: bool = False
    thread: Optional[threading.Thread] = field(default_factory=none_factory)
    node: Optional["dronecan.node.Node"] = field(default_factory=none_factory)
    fileserver: Optional["yukon.services.mydronecan.file_server.SimpleFileServer"] = field(default_factory=none_factory)
    node_monitor: Optional["yukon.services.mydronecan.node_monitor.NodeMonitor"] = field(default_factory=none_factory)
    allocator: Optional["dronecan.app.dynamic_node_id.CentralizedServer"] = field(default_factory=none_factory)


class GodState:
    def __init__(self) -> None:
        self.queues = QueuesState()
        self.gui = GuiState()
        self.cyphal = CyphalState()
        self.dronecan = DroneCanState()
        self.avatar = AvatarState()
        self.allocation = AllocationState()
        self.hardcoded_initial_settings = {
            "DSDL search directories": [{"__type__": "dirpath", "value": ReactiveValue(str(Path.home() / ".cyphal"))}],
            "UI": {"Registers": {"Column width (pixels)": 400, "Wrap cell text": False}},
            "Node allocation": {
                "__type__": "radio",
                "values": [
                    {
                        "value": "Automatic persistent allocation",
                        "description": "This will take some more time, the node will be restarted after it gets its node-id.",
                    },
                    "Automatic",
                    {"value": "Manual", "description": "Switch to this to turn off Node allocation"},
                ],
                "chosen_value": ReactiveValue("Automatic"),
                "name": "Node allocation",
            },
            "Firmware updates": {
                "Enabled": ReactiveValue(False),
                "Directory path": {"__type__": "dirpath", "value": ReactiveValue("")},
                "File path": "__deleted__",
            },
            "Monitor view": {
                "Show link name on another line": ReactiveValue(True),
                "Link info width": ReactiveValue(300),
                "Vertical line width": ReactiveValue(2),
                "Horizontal line width": ReactiveValue(2),
                "Distance between vertical lines": ReactiveValue(60),
                "Node width": ReactiveValue(250),
                "Distance per horizontal connection": ReactiveValue(20),
                "Show name above datatype": ReactiveValue(True),
                "Highlight colors": ["red", "green", "yellow", "orange", "purple", "brown", "aquamarine", "deeppink"],
                "Default saved subscription messages capacity": ReactiveValue(50),
                "Display unassigned port name and datatype on two lines": ReactiveValue(True),
                "Subscriptions": {
                    "Blink mode": {
                        "__type__": "radio",
                        "values": [
                            {
                                "value": "Blink at backend fetch rate",
                                "description": "Shows the frequency of backend fetch visually.",
                            },
                            {
                                "value": "Blink at new received messages",
                                "description": "Shows the frequency of received messages.",
                            },
                            {
                                "value": "Don't blink",
                                "description": "No flashes.",
                            },
                        ],
                        "chosen_value": ReactiveValue("Don't blink"),
                        "name": "Blink mode",
                    },
                    "Show Stream to PlotJuggler option": ReactiveValue(True),
                    "Show log to console option": ReactiveValue(False),
                    "Default fetch delay (ms)": ReactiveValue(300),
                },
                "Colors": {
                    "Publisher color": ReactiveValue("lightgreen"),
                    "Publisher text color": ReactiveValue("black"),
                    "Subscriber color": ReactiveValue("pink"),
                    "Subscriber text color": ReactiveValue("black"),
                    "Service color": ReactiveValue("lightblue"),
                    "Service text color": ReactiveValue("black"),
                },
            },
            "UDP subscription output": {
                "Enabled": ReactiveValue(False),
                "IP address": ReactiveValue("127.0.0.1"),
                "Port": ReactiveValue(9870),
            },
        }
        self.settings: typing.Optional[ReactiveValue] = None
        self.callbacks: typing.Any = {
            "yukon_node_created": [],
            "yukon_node_attached": [],
        }
        self.last_settings_hash: int = 0
        self.dronecan_traffic_queues = DroneCanTrafficQueues()
        self.messages_publisher: Optional[MessagesPublisher] = field(default_factory=none_factory)
        self.cyphal_worker_asyncio_loop = None
        self.api = None
        self.log_file = None
        self.main_loop = None
        self.known_datatypes = None
        self.last_known_datatypes_fetch_time = None
        self.allowed_datatypes_validity_time = 10
