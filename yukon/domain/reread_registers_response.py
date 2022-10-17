from dataclasses import dataclass
from uuid import UUID
import typing


@dataclass
class RereadRegistersResponse:
    id: UUID
    success: bool
    failed_pairs: typing.List[typing.Tuple[int, str]]
