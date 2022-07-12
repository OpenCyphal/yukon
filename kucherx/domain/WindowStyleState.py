from dataclasses import dataclass

from domain.UID import UID


@dataclass
class WindowStyleState:
    font: UID
    theme: UID
