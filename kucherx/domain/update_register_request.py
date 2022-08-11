from dataclasses import dataclass

import uavcan.register


@dataclass
class UpdateRegisterRequest:
    register_name: str
    value: uavcan.register.Value_1
    node_id: int
