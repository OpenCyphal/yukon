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
    message: str

    def to_builtin(self):
        return {
            "request_id": str(self.request_id),
            "register_name": self.register_name,
            "node_id": self.node_id,
            "success": self.success,
            "message": self.message,
        }
