from dataclasses import dataclass

from yukon.domain.UID import UID


@dataclass
class WindowStyleState:
    font: UID
    theme: UID
