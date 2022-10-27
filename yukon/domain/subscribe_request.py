from dataclasses import dataclass

from yukon.domain.subject_specifier import SubjectSpecifier


@dataclass
class SubscribeRequest:
    specifier: SubjectSpecifier
