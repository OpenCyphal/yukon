from dataclasses import dataclass


@dataclass
class ChangeFileserverPathRequest:
    path: str
