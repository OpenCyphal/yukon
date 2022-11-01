from _typeshed import Incomplete
from yukon.domain.interfaces.interface import Interface as Interface


class DetachTransportResponse:
    is_success: Incomplete
    interface_disconnected: Incomplete
    message: Incomplete

    def __init__(self, is_success: bool, interface_disconnected: Interface, message: str) -> None: ...
