from yukon.domain.interfaces.subject_specifier import SubjectSpecifier as SubjectSpecifier


class UnsubscribeResponse:
    specifier: SubjectSpecifier
    success: bool

    def __hash__(self) -> int: ...

    def __init__(self, specifier, success) -> None: ...
