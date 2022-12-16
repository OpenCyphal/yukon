import typing
from dataclasses import dataclass

import pycyphal

from yukon.domain.subject_specifier import SubjectSpecifier


@dataclass
class SynchronizedSubjectsSpecifier:
    specifiers: typing.List[SubjectSpecifier]

    def __hash__(self) -> int:
        return hash((self.message, self.metadata, self.counter))
