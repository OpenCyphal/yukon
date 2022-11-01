import uavcan.register
from uuid import UUID

class UpdateRegisterResponse:
    request_id: UUID
    register_name: str
    value: uavcan.register.Value_1
    node_id: int
    success: bool
    message: str
    def __init__(self, request_id, register_name, value, node_id, success, message) -> None: ...
