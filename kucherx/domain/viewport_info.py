from dataclasses import dataclass


@dataclass
class ViewPortInfo:
    title: str
    width: (int, int)
    height: (int, int)
    small_icon: str
    large_icon: str
    resizable: bool
