import copy
from dataclasses import dataclass
from typing import MutableMapping, Any

from pycyphal.application import make_registry, register

from yukon.domain.UID import UID
from yukon.domain.interface import Interface


@dataclass
class AttachTransportRequest:
    requested_interface: Interface
    local_node_id: int

    def get_registry(self) -> register.Registry:
        registry = make_registry()
        if self.requested_interface.iface != "":
            registry["uavcan.can.iface"] = copy.copy(self.requested_interface.iface)
        if self.requested_interface.mtu != 0:
            registry["uavcan.can.mtu"] = self.requested_interface.mtu
        if self.requested_interface.rate_data != 0:
            registry["uavcan.can.bitrate"] = [self.requested_interface.rate_arb, self.requested_interface.rate_data]
        registry["uavcan.node.id"] = self.local_node_id
        if self.requested_interface.udp_iface != "":
            registry["uavcan.udp.iface"] = copy.copy(self.requested_interface.udp_iface)
        if self.requested_interface.udp_mtu != 0:
            registry["uavcan.udp.mtu"] = self.requested_interface.udp_mtu
        return registry
