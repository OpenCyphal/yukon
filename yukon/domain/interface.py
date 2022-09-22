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
    def to_builtin(self) -> dict:
        return {
            "iface": self.iface,
            "mtu": self.mtu,
            "rate_data": self.rate_data,
            "rate_arb": self.rate_arb,
            "is_udp": self.is_udp,
            "udp_iface": self.udp_iface,
            "udp_mtu": self.udp_mtu,
            "hash": str(self.__hash__()),
        }
    
    def __hash__(self) -> int:
        return hash((self.iface, self.mtu, self.rate_data, self.rate_arb, self.is_udp, self.udp_iface, self.udp_mtu))