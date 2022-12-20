import typing
from dataclasses import dataclass

import pycyphal

from yukon.domain.subject_specifier import SubjectSpecifier


@dataclass
class SynchronizedSubjectsSpecifier:
    specifiers: typing.List[SubjectSpecifier]

    def __init__(self, specifiers: typing.List[str]) -> None:
        for specifier in specifiers:
            if isinstance(specifier, str):
                self.specifiers.append(SubjectSpecifier.from_string(specifier))
            elif isinstance(specifier, SubjectSpecifier):
                self.specifiers.append(specifier)

    def __hash__(self) -> int:
        return hash(frozenset(self.specifiers))
