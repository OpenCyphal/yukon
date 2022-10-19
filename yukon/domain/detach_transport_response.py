from yukon.domain.interface import Interface


class DetachTransportResponse:
    def __init__(self, is_success: bool, interface_disconnected: Interface, message: str) -> None:
        self.is_success = is_success
        self.interface_disconnected = interface_disconnected
        self.message = message

    def to_builtin(self) -> dict:
        return {
            "is_success": self.is_success,
            "interface_disconnected": self.interface_disconnected.to_builtin(),
            "message": self.message,
        }
