from dataclasses import dataclass


@dataclass
class SubjectSpecifier:
    subject_id: int
    datatype: str
    counter: int

    def __hash__(self) -> int:
        return hash((self.subject_id, self.datatype, self.counter))

    def __str__(self) -> str:
        return f"{self.subject_id}:{self.datatype}:{self.counter}"
