from dataclasses import dataclass


@dataclass
class Interface:
    def __init__(self) -> None:
        self.iface = ""
        self.mtu = 0
        self.rate_data = 0
        self.rate_arb = 0

    iface: str
    mtu: int
    rate_data: int
    rate_arb: int
