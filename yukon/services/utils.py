import importlib
import inspect
import os
import sys
import typing
from pathlib import Path
from queue import Queue, Empty
import logging
from typing import TypeVar

import pycyphal

logger = logging.getLogger(__name__)


def add_path_to_sys_path(path: str) -> None:
    normalized_sys_paths = [str(Path(path).resolve()) for path in sys.path]
    normalized_path = Path(path).resolve()
    if str(normalized_path) not in normalized_sys_paths:
        process_dsdl_path(Path(normalized_path))
        sys.path.append(str(normalized_path))
        logger.debug("Added %r to sys.path", normalized_path)


def get_datatypes_from_packages_directory_path(path: Path) -> typing.Any:
    """The path is to a folder like .compiled which contains dsdl packages"""
    return_object: typing.Any = {
        "fixed_id_messages": {},
        "variable_id_messages": [],
    }
    for package_folder_str in list(next(os.walk(path))[1]):
        package_folder = (path / package_folder_str).absolute()
        add_path_to_sys_path(str(package_folder.absolute()))
        package = importlib.import_module(package_folder.name)
        # pycyphal.util.import_submodules(package)
        # sys.path.remove(str(package_folder.absolute()))

        queue: Queue = Queue()
        queue.put((package, None))  # No previous class
        counter = 0
        try:
            while True:
                counter += 1
                module_or_class, previous_module_or_class = queue.get_nowait()
                elements = inspect.getmembers(module_or_class, lambda x: inspect.ismodule(x) or inspect.isclass(x))
                for element in elements:
                    if element[1].__name__ == "object" or element[1].__name__ == "type":
                        continue
                    queue.put((element[1], module_or_class))  # Previous class was module_or_class
                if inspect.isclass(module_or_class):
                    _class = module_or_class
                    if not hasattr(module_or_class, "_deserialize_") and not hasattr(module_or_class, "_serialize_"):
                        continue
                    try:
                        model = pycyphal.dsdl.get_model(_class)
                    except Exception:
                        logger.exception("Failed to get model for %s", _class)
                        continue
                    if hasattr(_class, "_FIXED_PORT_ID_"):
                        desired_class_name = _class.__name__
                        return_object["fixed_id_messages"][str(_class._FIXED_PORT_ID_)] = {
                            "short_name": desired_class_name,
                            "full_name": model.full_name,
                        }
                    elif hasattr(_class, "_serialize_"):
                        return_object["variable_id_messages"].append(model.full_name)
        except Empty:
            pass
    # Deduplicate datatypes
    return_object["variable_id_messages"] = list(set(return_object["variable_id_messages"]))
    return return_object


def process_dsdl_path(path: Path) -> None:
    pass
    # for package_folder_str in list(next(os.walk(path))[1]):
    #     package_folder = (path / package_folder_str).absolute()
    #     sys.path.append(str(package_folder.absolute()))
    #     try:
    #         package = importlib.import_module(package_folder.name)
    #         pycyphal.util.import_submodules(package)
    #     except Exception:
    #         logger.warning("Failed to import %s", package_folder.name)
    #     finally:
    #         sys.path.remove(str(package_folder.absolute()))

# These are for calculating the tolerance for the MonotonicClusteringSynchronizer
T = TypeVar("T")


def tolerance_from_key_delta(old: T, new: T) -> T:
    return (new - old) * 0.5  # type: ignore


def clamp(lo_hi: tuple[T, T], val: T) -> T:
    lo, hi = lo_hi
    return min(max(lo, val), hi)  # type: ignore
