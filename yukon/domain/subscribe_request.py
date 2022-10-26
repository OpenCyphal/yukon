from dataclasses import dataclass

from yukon.domain.subject_specifier import SubjectSpecifier


@dataclass
class SubscribeRequest:
    subject_id: int
    datatype: str

    def __hash__(self) -> int:
        return hash((self.subject_id, self.datatype))

    def get_count_specifier(self, counter: int) -> SubjectSpecifier:
        return SubjectSpecifier(self.subject_id, self.datatype, counter)

    def get_specifier(self) -> SubjectSpecifier:
        return SubjectSpecifier(self.subject_id, self.datatype, 0)