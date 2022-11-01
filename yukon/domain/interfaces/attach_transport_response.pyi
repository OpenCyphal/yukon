class AttachTransportResponse:
    is_success: bool
    message: str
    message_short: str
    def __init__(self, is_success, message, message_short) -> None: ...
