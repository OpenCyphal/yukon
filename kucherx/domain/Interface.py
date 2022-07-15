from dataclasses import dataclass


@dataclass
class Interface:
    def __init__(self):
        pass

    iface: str
    mtu: int
    rate_data: int
    rate_arb: int
