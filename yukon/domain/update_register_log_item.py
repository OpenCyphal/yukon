import typing
from typing import Optional
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

import uavcan.register
from yukon.domain.update_register_response import UpdateRegisterResponse


@dataclass
class UpdateRegisterLogItem:
    response: UpdateRegisterResponse
    request_sent_time: Optional[str]
    response_received_time: Optional[str]
    previous_value: str

    def to_builtin(self) -> typing.Dict[str, typing.Any]:
        return {
            "response": self.response.to_builtin(),
            "request_sent_time": self.request_sent_time,
            "response_received_time": self.response_received_time,
            "previous_value": self.previous_value,
        }
