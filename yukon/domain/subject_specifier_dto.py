from dataclasses import dataclass

from yukon.domain.subject_specifier import SubjectSpecifier


class SubjectSpecifierDto:
    subject_id: int
    datatype: str
    counter: int

    def __init__(self):
        pass

    def to_subject_specifier(self):
        subject_specifier = SubjectSpecifier()
        subject_specifier.subject_id = self.subject_id
        subject_specifier.datatype = self.datatype

    @staticmethod
    def from_string(string: str):
        split_values = string.split(":")
        specifier = SubjectSpecifierDto()
        specifier.subject_id = int(split_values[0])
        specifier.datatype = split_values[1]
        specifier.counter = split_values[2]
        return specifier

    def does_equal_specifier(self, subject_specifier: SubjectSpecifier):
        return self.subject_id == subject_specifier.subject_id and self.datatype == self.datatype

    def __hash__(self) -> int:
        return hash((self.subject_id, self.datatype, self.counter))

    def __str__(self) -> str:
        return f"{self.subject_id}:{self.datatype}:{self.counter}"
