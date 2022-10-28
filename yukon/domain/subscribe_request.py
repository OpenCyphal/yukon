from dataclasses import dataclass

from yukon.domain.subject_specifier import SubjectSpecifier


@dataclass
class SubscribeRequest:
    specifier: SubjectSpecifier

    def __hash__(self) -> int:
        return hash(self.specifier)
