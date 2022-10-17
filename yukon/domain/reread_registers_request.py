from dataclasses import dataclass
from uuid import UUID
import typing


@dataclass
class RereadRegistersRequest:
    id: UUID
    pairs: typing.List[typing.Tuple[int, str]]
