import pathlib
import time
import typing


def get_root_directory() -> pathlib.Path:
    from os.path import exists

    current = pathlib.Path(__file__).parent
    time_started = time.time()

    while time_started - time.time() < 0.1:
        if exists(current / "LICENSE") or exists(current / ".gitignore"):
            return current.resolve()
        else:
            current = current.parent
    raise Exception("No root directory found")


def get_kucherx_directory() -> pathlib.Path:
    return get_root_directory() / "yukon"


def get_sources_directory() -> pathlib.Path:
    return pathlib.Path(__file__).parent.resolve()


def get_resources_directory() -> pathlib.Path:
    return get_kucherx_directory() / "res"
