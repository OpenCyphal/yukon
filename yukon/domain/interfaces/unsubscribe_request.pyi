from yukon.domain.interfaces.subject_specifier import SubjectSpecifier as SubjectSpecifier


class UnsubscribeRequest:
    specifier: SubjectSpecifier

    def __hash__(self) -> int: ...

    def __init__(self, specifier) -> None: ...
