from dataclasses import dataclass
from typing import MutableMapping

from pycyphal.application.register import ValueProxy

from kucherx.domain.UID import UID
from kucherx.domain.interface import Interface


@dataclass
class AttachTransportRequest:
    requesting_window_id: UID
    requested_interface: Interface
    requested_mtu: int
    requested_data_rate: int
    requested_arb_rate: int
    local_node_id: int

    def get_registers(self) -> MutableMapping[str, ValueProxy]:
        registers = {"uavcan.can.iface": ValueProxy(self.requested_interface),
                     "uavcan.can.bitrate": ValueProxy(f"{self.requested_arb_rate} {self.requested_data_rate}"),
                     "uavcan.node.id": ValueProxy(self.local_node_id),
                     "uavcan.can.mtu": ValueProxy(self.requested_mtu)
                     }
        return registers

