from dataclasses import dataclass

from yukon.domain.subject_specifier import SubjectSpecifier


@dataclass
class UnsubscribeResponse:
    specifier: SubjectSpecifier
    success: bool

    def __hash__(self) -> int:
        return hash(self.specifier)
