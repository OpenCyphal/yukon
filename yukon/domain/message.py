import dataclasses
import typing
from dataclasses import dataclass


@dataclass
class Message:
    message: str
    timestamp: float = 0.0
    index_nr: int = 0
    is_internal_use_only: bool = True
    arguments: list[str] = dataclasses.field(default_factory=list)
    severity_number: int = 0
    severity_text: str = ""

    def asdict(self) -> typing.Any:
        return {
            "message": self.message,
            "timestamp": self.timestamp,
            "index": self.index_nr,
            "internal": self.is_internal_use_only,
            "severity_nr": self.severity_number,
            "severity_text": self.severity_text,
        }
