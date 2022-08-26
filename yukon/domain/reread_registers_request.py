from dataclasses import dataclass

import typing


@dataclass
class RereadRegistersRequest:
    pairs: typing.List[typing.Tuple[int, str]]