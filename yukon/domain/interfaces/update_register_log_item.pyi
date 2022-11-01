from datetime import datetime as datetime
from typing import Optional
from uuid import UUID as UUID
from yukon.domain.interfaces.update_register_response import UpdateRegisterResponse as UpdateRegisterResponse


class UpdateRegisterLogItem:
    response: Optional[UpdateRegisterResponse]
    register_name: str
    request_sent_time: Optional[str]
    response_received_time: Optional[str]
    previous_value: Optional[str]
    success: bool

    def __init__(self, response, register_name, request_sent_time, response_received_time, previous_value,
                 success) -> None: ...
