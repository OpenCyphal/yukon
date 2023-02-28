from dataclasses import dataclass


@dataclass
class Interface:
    def __init__(self) -> None:
        self.iface = ""
        self.mtu = 0
        self.rate_data = 0
        self.rate_arb = 0
        self.udp_iface = ""
        self.udp_mtu = 0
        self.is_udp = False
        self.node_id = 0

    iface: str
    mtu: int
    rate_data: int
    rate_arb: int
    is_udp: bool
    udp_iface: str
    udp_mtu: int

    def __hash__(self) -> int:
        return hash((self.iface, self.mtu, self.rate_data, self.rate_arb, self.is_udp, self.udp_iface, self.udp_mtu))
