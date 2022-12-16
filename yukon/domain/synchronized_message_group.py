from dataclasses import dataclass
import typing

from yukon.domain.synchronized_message_carrier import SynchronizedMessageCarrier
from yukon.domain.subject_specifier import SubjectSpecifier


@dataclass
class SynchronizedMessageGroup:
    carriers: typing.List[SynchronizedMessageCarrier]
    arrival_time: float
