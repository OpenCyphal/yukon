from dataclasses import dataclass


@dataclass
class AttachTransportResponse:
    """A class that holds the response of an attach_transport_request."""

    is_success: bool
    message: str = ""
    message_short: str = ""

    def to_builtin(self) -> dict:
        return {
            "is_success": self.is_success,
            "message": self.message,
            "message_short": self.message_short,
        }
