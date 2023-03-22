from dataclasses import dataclass


@dataclass
class StorePersistentStatesRequest:
    node_id: int
    delay_seconds: float
