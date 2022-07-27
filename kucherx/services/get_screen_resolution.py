import logging
import os
import typing

logger = logging.getLogger(__file__)


def get_screen_resolution() -> typing.Tuple[int, int]:
    """If the screen size is known then the close dialog can be centered via its position"""
    if os.name == "nt":
        import ctypes

        user32 = ctypes.windll.user32 # type: ignore
        return user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)
    else:
        logger.warning("Screen resolution detection is not yet implemented for non-windows platforms.")
        return 1280, 720
