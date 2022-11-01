class ApplyConfigurationRequest:
    node_id: int
    configuration: str
    is_network_config: bool
    def __init__(self, node_id, configuration, is_network_config) -> None: ...
