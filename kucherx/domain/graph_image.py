import typing
from dataclasses import dataclass


@dataclass
class GraphImage:
    image_size: typing.Tuple[int, int]
    image: typing.List[int]
