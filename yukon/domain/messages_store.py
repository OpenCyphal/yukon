import typing
from dataclasses import dataclass, field

import pycyphal

from domain.message_carrier import MessageCarrier


@dataclass
class MessagesStore:
    messages: typing.List[MessageCarrier] = field(default_factory=list)
    counter: int = 0

    def __hash__(self) -> int:
        """I don't think this is reliable"""
        return hash((self.messages, self.counter))
