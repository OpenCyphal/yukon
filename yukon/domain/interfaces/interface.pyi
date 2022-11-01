class Interface:
    iface: str
    mtu: int
    rate_data: int
    rate_arb: int
    udp_iface: str
    udp_mtu: int
    is_udp: bool
    def __init__(self) -> None: ...
    def __hash__(self) -> int: ...
