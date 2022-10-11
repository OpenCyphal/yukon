from dataclasses import dataclass
from uuid import UUID

import uavcan.register


@dataclass
class UpdateRegisterResponse:
    request_id: UUID
    register_name: str
    value: uavcan.register.Value_1
    node_id: int
    success: bool
