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

    def to_builtin(self) -> typing.Dict[str, typing.Any]:
        return {
            "request_id": str(self.request_id),
            "register_name": self.register_name,
            "value": self.value,
            "node_id": self.node_id,
            "success": self.success,
            "message": self.message,
        }
