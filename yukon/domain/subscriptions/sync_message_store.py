import typing
from dataclasses import dataclass, field

import pycyphal

from yukon.domain.subscriptions.sync_message_group import SynchronizedMessageGroup


@dataclass
class SynchronizedMessageStore:
    specifiers: str
    messages: typing.List[SynchronizedMessageGroup] = field(default_factory=list)
    counter: int = 0
    capacity: int = 50
    start_index: int = 0

    def __hash__(self) -> int:
        """I don't think this is reliable"""
        return hash(self.specifiers)
