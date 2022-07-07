from dataclasses import dataclass


@dataclass
class CyphalLocalNodeSettings:
    UAVCAN__CAN__MTU: int
    UAVCAN__CAN__IFACE: str
    UAVCAN__NODE__ID: int
    UAVCAN__CAN__BITRATE: str
    arbitration_bitrate: int
    data_bitrate: int
