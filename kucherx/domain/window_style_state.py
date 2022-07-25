from dataclasses import dataclass

from kucherx.domain.UID import UID


@dataclass
class WindowStyleState:
    font: UID
    theme: UID
