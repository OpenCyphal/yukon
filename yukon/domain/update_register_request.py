from dataclasses import dataclass
from uuid import UUID

import uavcan.register


@dataclass
class UpdateRegisterRequest:
    request_id: UUID
    register_name: str
    value: uavcan.register.Value_1
    node_id: int

    def to_builtin(self):
        return {
            "request_id": str(self.request_id),
            "register_name": self.register_name,
            "value": self.value,
            "node_id": self.node_id
        }
