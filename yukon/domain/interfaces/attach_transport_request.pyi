from pycyphal.application import register as register
from yukon.domain.interfaces.UID import UID as UID
from yukon.domain.interfaces.interface import Interface as Interface


class AttachTransportRequest:
    requested_interface: Interface
    local_node_id: int

    def get_registry(self) -> register.Registry: ...

    def __init__(self, requested_interface, local_node_id) -> None: ...
