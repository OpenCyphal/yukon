import dataclasses
from dataclasses import dataclass


@dataclass
class Message:
    message: str
    timestamp: float = 0.0
    index: int = 0

    def asdict(self):
        return {
            "message": self.message,
            "timestamp": self.timestamp,
            "index": self.index
        }
