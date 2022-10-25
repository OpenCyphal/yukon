import typing
from dataclasses import dataclass
from uuid import UUID

import uavcan.register


@dataclass
class UpdateRegisterResponse:
    request_id: UUID
    register_name: str
    value: str
    node_id: int
    success: bool
    message: str
