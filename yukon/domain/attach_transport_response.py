from dataclasses import dataclass


@dataclass
class AttachTransportResponse:
    """A class that holds the response of an attach_transport_request."""

    is_success: bool
    message: str = ""
    message_short: str = ""
