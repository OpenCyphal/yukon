from dataclasses import dataclass
import typing

from yukon.domain.subscriptions.sync_message_carrier import SynchronizedMessageCarrier
from yukon.domain.subject_specifier import SubjectSpecifier


@dataclass
class SynchronizedMessageGroup:
    carriers: typing.List[SynchronizedMessageCarrier]
    arrival_time: float

    def __init__(self) -> None:
        self.carriers = []
        self.arrival_time = 0.0
        pass
