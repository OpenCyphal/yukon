class ViewPortInfo:
    title: str
    width: int
    height: int
    small_icon: str
    large_icon: str
    resizable: bool
    def __init__(self, title, width, height, small_icon, large_icon, resizable) -> None: ...
