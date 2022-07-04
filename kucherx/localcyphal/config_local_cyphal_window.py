"""This will be the window where you can configure the local node."""
import time

import dearpygui.dearpygui as dpg  # type: ignore
import pathlib


def get_root_directory():
    from os.path import exists
    current = pathlib.Path(__file__).parent
    time_started = time.time()
    while time_started - time.time() < 0.1:
        if exists(current / "LICENSE") or exists(current / ".gitignore"):
            return current.resolve()
        else:
            current = current.parent
    return None


def get_sources_directory():
    return pathlib.Path(__file__).parent.resolve()


def get_resources_directory():
    return get_root_directory() / "res"
