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

    def to_builtin(self) -> typing.Dict[str, typing.Any]:
        return {
            "request_id": str(self.request_id),
            "register_name": self.register_name,
            "value": self.value,
            "node_id": self.node_id,
        }
