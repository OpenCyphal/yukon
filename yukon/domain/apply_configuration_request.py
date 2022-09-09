from dataclasses import dataclass


@dataclass
class ApplyConfigurationRequest:
    node_id: int
    configuration: str
    is_network_config: bool
