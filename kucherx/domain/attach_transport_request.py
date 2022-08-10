import copy
from dataclasses import dataclass
from typing import MutableMapping, Any

from pycyphal.application import make_registry, register

from kucherx.domain.UID import UID
from kucherx.domain.interface import Interface


@dataclass
class AttachTransportRequest:
    requested_interface: Interface
    local_node_id: int

    def get_registry(self) -> register.Registry:
        registry = make_registry()
        registry["uavcan.can.iface"] = copy.copy(self.requested_interface.iface)
        registry["uavcan.can.mtu"] = self.requested_interface.mtu
        registry["uavcan.can.bitrate"] = [self.requested_interface.rate_arb, self.requested_interface.rate_data]
        registry["uavcan.node.id"] = self.local_node_id
        return registry
