import typing
from dataclasses import dataclass
from uuid import UUID


@dataclass
class UpdateRegisterResponse:
    request_id: UUID
    register_name: str
    value: typing.Any  # actually uavcan.register.Value_1
    node_id: int
    success: bool
    message: str
