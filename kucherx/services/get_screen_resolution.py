import logging
import os
import typing
import platform
logger = logging.getLogger(__file__)
import tkinter as tk
import re


def get_screen_resolution() -> typing.Tuple[int, int]:
    """If the screen size is known then the close dialog can be centered via its position"""
    # if platform.system() == "Windows":
    #     import ctypes
    #
    #     user32 = ctypes.windll.user32  # type: ignore
    #     return user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)
    # else:
    root = tk.Tk()
    root.update_idletasks()
    root.attributes('-fullscreen', True)
    root.state('iconic')
    geometry = root.winfo_geometry()
    # '3840x2160+0+0'
    root.destroy()
    x, y = map(int, geometry.split("+")[0].split("x"))
    return x, y
