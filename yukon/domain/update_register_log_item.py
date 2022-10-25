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
