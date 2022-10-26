from dataclasses import dataclass


@dataclass
class SubscribeRequest:
    subject_id: int
    datatype: str

    def __hash__(self) -> int:
        return hash((self.subject_id, self.datatype))
