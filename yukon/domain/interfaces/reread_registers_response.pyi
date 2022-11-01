import typing
from uuid import UUID

class RereadRegistersResponse:
    id: UUID
    success: bool
    failed_pairs: typing.List[typing.Tuple[int, str]]
    def __init__(self, id, success, failed_pairs) -> None: ...
