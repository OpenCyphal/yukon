import json
import logging
import math
import typing
from typing import Optional, Any, Callable

import pycyphal
from pycyphal.transport import ServiceDataSpecifier, Timestamp, AlienTransfer, MessageDataSpecifier

from kucherx.domain.note_state import NodeState
from kucherx.domain.port_set import PortSet
from kucherx.domain._expand_subjects import expand_subjects, expand_mask
from kucherx.domain.iface import Iface
import uavcan
from kucherx.services.value_utils import _simplify_value, explode_value

logger = logging.getLogger()
logger.setLevel("ERROR")


class Avatar:  # pylint: disable=too-many-instance-attributes
    def __init__(
        self,
        iface: Iface,
        node_id: int,
        info: Optional[uavcan.node.GetInfo_1_0.Response] = None,
        previous_port_list_hash: Optional[int] = None,
    ) -> None:
        import uavcan.node
        import uavcan.node.port

        self._node_id = node_id

        self._heartbeat: Optional[uavcan.node.Heartbeat_1_0] = None
        self._iface = iface
        self._info = info
        self._register_set: typing.Set[str] = set([])
        self.register_values: typing.Dict[str, str] = {}
        self.register_exploded_values: typing.Dict[str, typing.Dict[str, Any]] = {}
        self.access_requests_names_by_transfer_id: typing.Dict[int, str] = {}
        self._last_register_request_name = ""
        self._num_info_requests = 0

        self._ts_activity = -math.inf
        self._ts_heartbeat = -math.inf
        self._ts_port_list = -math.inf
        self._ts_info_request = -math.inf

        self._ports = PortSet()

        self._dispatch: dict[
            Any | tuple[Any, ServiceDataSpecifier.Role],
            Callable[[float, Any], None] | Callable[[float, Any, int], None],
        ] = {
            (uavcan.node.GetInfo_1_0, ServiceDataSpecifier.Role.RESPONSE): self._on_info_response,
            (uavcan.register.List_1, ServiceDataSpecifier.Role.RESPONSE): self._on_list_response,
            (uavcan.register.Access_1, ServiceDataSpecifier.Role.REQUEST): self._on_access_request,
            (uavcan.register.Access_1, ServiceDataSpecifier.Role.RESPONSE): self._on_access_response,
            uavcan.node.port.List_0_1: self._on_port_list,
            uavcan.node.Heartbeat_1_0: self._on_heartbeat,
        }

        self._iface.add_standard_subscription(uavcan.node.Heartbeat_1_0)
        self._iface.add_standard_subscription(uavcan.node.port.List_0_1)
        self._iface.add_trace_handler(self._on_trace)

    # A getter for the node ID.
    @property
    def node_id(self) -> int:
        return self._node_id

    def _restart(self) -> None:
        self._info = None
        self._num_info_requests = 0
        self._ts_port_list = -math.inf

    def _on_info_response(self, ts: float, obj: Any) -> None:
        import uavcan.node

        assert isinstance(obj, uavcan.node.GetInfo_1_0.Response)
        _ = ts
        self._info = obj

    def _on_access_request(self, ts: float, obj: Any, transfer_id: int) -> None:
        import uavcan.register
        import uavcan.node

        assert isinstance(obj, uavcan.register.Access_1.Request)
        _ = ts
        self.access_requests_names_by_transfer_id[transfer_id] = obj.name.name.tobytes().decode()

    def _on_access_response(self, ts: float, obj: Any, transfer_id: int) -> None:
        import uavcan.register
        import uavcan.node

        assert isinstance(obj, uavcan.register.Access_1.Response)
        _ = ts
        register_name = self.access_requests_names_by_transfer_id[transfer_id]
        if register_name == "uavcan.node.unique_id":
            unstructured_value = obj.value.unstructured
            array = bytearray(unstructured_value.value)
            # Convert to hex string
            self.register_values[register_name] = "0x" + "".join("{:02x}".format(c) for c in array)
            return
        exploded_value = explode_value(obj.value)
        self.register_exploded_values[register_name] = exploded_value
        self.register_values[register_name] = str(_simplify_value(obj.value))

    def _on_list_response(self, ts: float, obj: Any) -> None:
        import uavcan.node

        assert isinstance(obj, uavcan.register.List_1.Response)
        _ = ts
        self._register_set.add(obj.name.name.tobytes().decode())

    def _on_port_list(self, ts: float, obj: Any) -> None:
        import uavcan.node.port

        assert isinstance(obj, uavcan.node.port.List_0_1)
        self._ports.pub = expand_subjects(obj.publishers)
        self._ports.sub = expand_subjects(obj.subscribers)
        self._ports.cln = expand_mask(obj.clients.mask)
        self._ports.srv = expand_mask(obj.servers.mask)
        self._ts_port_list = ts

    def _on_heartbeat(self, ts: float, obj: Any) -> None:
        from uavcan.node import Heartbeat_1_0 as Heartbeat, GetInfo_1_0 as GetInfo

        assert isinstance(obj, Heartbeat)

        # We used to have a node-ID collision heuristic here that checked if the timestamp is oscillating back and
        # forth, as it would indicate that there are multiple nodes running on the same node-ID. While this
        # heuristic is correct, it is ineffective in practice because heartbeats of nodes with a lower uptime
        # would have lower transfer-ID values, which (unless the transport is cyclic-TID) would make the transfer
        # reassembler discard such new heartbeats from conflicting nodes as duplicates (already seen transfers).
        # It is therefore impossible to detect collisions at this layer (it is possible only below the transport
        # layer). Although it might *occasionally* work if the heartbeats are delayed or published irregularly.

        # Invalidate the node info if the uptime goes backwards or if we received a heartbeat after a long pause.
        restart = self._heartbeat and (
            (self._heartbeat.uptime > obj.uptime) or (ts - self._ts_heartbeat > Heartbeat.OFFLINE_TIMEOUT)
        )
        if restart:
            logger.info("%r: Restart detected: %r", self, obj)
            self._restart()

        if not self._info and self._node_id is not None:
            timeout = 2 ** (self._num_info_requests + 2)
            if ts - self._ts_info_request >= timeout:
                logger.debug("%r: Would request info; timeout=%.1f", self, timeout)
                self._num_info_requests += 1
                self._ts_info_request = ts
                self._iface.try_request(GetInfo, self._node_id, GetInfo.Request())

        self._heartbeat = obj
        self._ts_heartbeat = ts

    def _on_trace(self, ts: Timestamp, tr: AlienTransfer) -> None:
        from pycyphal.dsdl import get_fixed_port_id

        own = (
            tr.metadata.session_specifier.source_node_id == self._node_id
            or tr.metadata.session_specifier.destination_node_id == self._node_id
        )
        if not own:
            return
        ds = tr.metadata.session_specifier.data_specifier
        self._ts_activity = float(ts.monotonic)

        # Snoop on transfers sent by our node. Even if we can't ask we can still learn things by listening.
        for type, handler in self._dispatch.items():
            if isinstance(type, tuple):
                type, role = type
                assert isinstance(role, ServiceDataSpecifier.Role)
                if (
                    isinstance(ds, ServiceDataSpecifier)
                    and ds.role == role
                    and ds.service_id == get_fixed_port_id(type)
                ):
                    if handler == self._on_access_request:
                        logger.info("%r: Received access request", self)
                    rr = getattr(type, role.name.capitalize())
                    deserialized_object = pycyphal.dsdl.deserialize(rr, tr.fragmented_payload)
                    logger.debug("%r: Service snoop: %r from %r", self, deserialized_object, tr)
                    if deserialized_object is not None:
                        # These handlers take an additional argument, the transfer ID.
                        # They use it to connect the request to the response.
                        # The name of the requested register is stored in the access_requests_names_by_transfer_id
                        # Then when the response arrives, we can use the transfer ID to find the name of the register
                        # using the transfer ID.
                        if handler == self._on_access_response or handler == self._on_access_request:
                            handler(float(ts.monotonic), deserialized_object, tr.metadata.transfer_id)  # type: ignore
                        else:
                            # The other handlers don't take a transfer ID.
                            handler(float(ts.monotonic), deserialized_object)  # type: ignore
            elif (fpid := get_fixed_port_id(type)) is not None:
                if isinstance(ds, MessageDataSpecifier) and ds.subject_id == fpid:
                    deserialized_object = pycyphal.dsdl.deserialize(type, tr.fragmented_payload)
                    logger.debug("%r: Message snoop: %r from %r", self, deserialized_object, tr)
                    if deserialized_object is not None:
                        handler(float(ts.monotonic), deserialized_object)  # type: ignore
            else:
                assert False

    def update(self, ts: float) -> NodeState:
        from uavcan.node import Heartbeat_1_0 as Heartbeat
        from uavcan.node.port import List_0_1 as PortList

        if self._heartbeat and self._ts_activity - self._ts_heartbeat > Heartbeat.OFFLINE_TIMEOUT:
            logger.info("%r: Much more recent activity than the last heartbeat, we've gone zombie", self)
            self._heartbeat = None

        online = (ts - max(self._ts_heartbeat, self._ts_activity)) <= Heartbeat.OFFLINE_TIMEOUT
        port_introspection_valid = True  # (ts - self._ts_port_list) <= PortList.MAX_PUBLICATION_PERIOD * 2

        return NodeState(
            online=online,
            heartbeat=self._heartbeat,
            info=self._info,
            ports=self._ports if port_introspection_valid else None,
        )

    def to_builtin(self) -> Any:
        json_object: Any = {
            "node_id": self._node_id,
            "hash": self.__hash__(),
            "name": self._info.name.tobytes().decode() if self._info is not None else None,
            "ports": {
                "pub": list(self._ports.pub),
                "sub": list(self._ports.sub),
                "cln": list(self._ports.cln),
                "srv": list(self._ports.srv),
            },
            "registers": list(self._register_set),
            "registers_values": self.register_values,
            "registers_hash": hash(frozenset(self.register_values.items())),
            "registers_exploded_values": self.register_exploded_values,
        }
        return json_object

    def __hash__(self) -> int:
        # Create a hash from __ports.pub, __ports.sub, __ports.cln and __ports.srv
        return (
            hash(frozenset(self._ports.pub))
            ^ hash(frozenset(self._ports.sub))
            ^ hash(frozenset(self._ports.cln))
            ^ hash(frozenset(self._ports.srv))
            ^ hash(self._info.name.tobytes().decode() if self._info is not None else None)
        )

    def __repr__(self) -> str:
        return str(pycyphal.util.repr_attributes(self, node_id=self._node_id, port_set=self._ports))
