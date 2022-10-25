import typing
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

import uavcan.register


@dataclass
class UpdateRegisterRequest:
    request_id: UUID
    register_name: str
    value: uavcan.register.Value_1
    node_id: int
    request_sent_time: float
