import typing
from dataclasses import dataclass, field

import pycyphal

from yukon.domain.subscriptions.message_carrier import MessageCarrier


@dataclass
class MessagesStore:
    messages: typing.List[MessageCarrier] = field(default_factory=list)
    counter: int = 0
    enable_udp_output: bool = True
    capacity: int = 50
    start_index: int = 0

    def __hash__(self) -> int:
        """I don't think this is reliable"""
        return hash((self.messages, self.counter))
