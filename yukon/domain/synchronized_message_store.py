import typing
from dataclasses import dataclass, field

import pycyphal

from yukon.domain.synchronized_message_group import SynchronizedMessageGroup


@dataclass
class SynchronizedMessagesStore:
    messages: typing.List[SynchronizedMessageGroup] = field(default_factory=list)
    counter: int = 0

    def __hash__(self) -> int:
        """I don't think this is reliable"""
        return hash((self.messages, self.counter))
