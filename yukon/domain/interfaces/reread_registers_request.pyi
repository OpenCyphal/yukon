import typing
from uuid import UUID

class RereadRegistersRequest:
    id: UUID
    pairs: typing.List[typing.Tuple[int, str]]
    def __init__(self, id, pairs) -> None: ...
