class SubscribeResponse:
    subject_id: int
    datatype: str
    success: bool
    message: str
    def __hash__(self) -> int: ...
    def __init__(self, subject_id, datatype, success, message) -> None: ...
