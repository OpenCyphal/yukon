class CommandSendResponse:
    def __init__(self, is_success: bool, message: str) -> None:
        self.is_success = is_success
        self.message = message
