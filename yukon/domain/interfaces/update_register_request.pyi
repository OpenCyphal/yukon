import uavcan.register
from datetime import datetime as datetime
from uuid import UUID

class UpdateRegisterRequest:
    request_id: UUID
    register_name: str
    value: uavcan.register.Value_1
    node_id: int
    request_sent_time: float
    def __init__(self, request_id, register_name, value, node_id, request_sent_time) -> None: ...
