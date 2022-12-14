# Create a dataclass containing an ip address and port for a UDP connection
import dataclasses
import ipaddress
import typing


@dataclasses.dataclass
class UDPConnection:
    ip: ipaddress.IPv4Address
    port: int
