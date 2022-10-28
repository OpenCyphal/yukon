from dataclasses import dataclass


@dataclass
class SubscribeResponse:
    subject_id: int
    datatype: str
    success: bool
    message: str

    def __hash__(self) -> int:
        return hash((self.subject_id, self.datatype, self.success))
