from dataclasses import dataclass

@dataclass
class UpdateRegisterRequest:
    register_name: str
    value: str
    node_id: int
    exploded_value: str = None