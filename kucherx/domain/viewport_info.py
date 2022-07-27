import typing
from dataclasses import dataclass


@dataclass
class ViewPortInfo:
    title: str
    width: typing.Tuple[int, int]
    height: typing.Tuple[int, int]
    small_icon: str
    large_icon: str
    resizable: bool
