import typing
from yukon.domain.interfaces.subject_specifier import SubjectSpecifier


class SubjectSpecifierDto:
    subject_id: typing.Optional[int]
    datatype: str
    counter: int

    def __init__(self) -> None: ...

    def to_subject_specifier(self) -> SubjectSpecifier: ...

    @staticmethod
    def from_string(string: str) -> SubjectSpecifierDto: ...

    def does_equal_specifier(self, subject_specifier: SubjectSpecifier) -> bool: ...

    def __hash__(self) -> int: ...
