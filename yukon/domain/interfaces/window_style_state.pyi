from yukon.domain.interfaces.UID import UID as UID


class WindowStyleState:
    font: UID
    theme: UID

    def __init__(self, font, theme) -> None: ...
