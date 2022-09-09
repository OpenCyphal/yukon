from dataclasses import dataclass


@dataclass
class Interface:
    def __init__(self) -> None:
        self.iface = ""
        self.mtu = 0
        self.rate_data = 0
        self.rate_arb = 0
        self.udp_iface = ""
        self.is_udp = False

    iface: str
    mtu: int
    rate_data: int
    rate_arb: int
    is_udp: bool
    udp_iface: str
    udp_mtu: int
