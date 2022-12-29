from dataclasses import dataclass
import typing

from yukon.domain.subject_specifier import SubjectSpecifier


@dataclass
class SubscribeSynchronizedRequest:
    specifiers: typing.List[SubjectSpecifier]
