import typing
from dataclasses import dataclass


@dataclass
class ViewPortInfo:
    title: str
    width: int
    height: int
    small_icon: str
    large_icon: str
    resizable: bool
