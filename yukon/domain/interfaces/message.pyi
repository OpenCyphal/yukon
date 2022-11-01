class Message:
    message: str
    timestamp: float
    index_nr: int
    severity_number: int
    severity_text: str
    module: str
    def __init__(self, message, timestamp, index_nr, severity_number, severity_text, module) -> None: ...
