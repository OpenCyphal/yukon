import dataclasses
import typing
from dataclasses import dataclass


@dataclass
class Message:
    message: str
    timestamp: float = 0.0
    index_nr: int = 0

    def asdict(self) -> typing.Any:
        return {
            "message": self.message,
            "timestamp": self.timestamp,
            "index": self.index_nr
        }
