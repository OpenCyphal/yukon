import dataclasses
import typing
from dataclasses import dataclass


@dataclass
class Message:
    message: str
    timestamp: str = ""
    index_nr: int = 0
    # Severities:
    # CRITICAL = 50
    # FATAL = CRITICAL
    # ERROR = 40
    # WARNING = 30
    # WARN = WARNING
    # INFO = 20
    # DEBUG = 10
    # NOTSET = 0
    severity_number: int = 0
    severity_text: str = ""
    module: str = ""

    def __str__(self) -> str:
        return f"{self.timestamp} {self.module} {self.severity_text[0]}: {self.message}"
