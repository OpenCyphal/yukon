import importlib
import inspect
import os
import sys
import typing
from pathlib import Path
from queue import Queue, Empty
import logging

import pycyphal

logger = logging.getLogger(__name__)


def get_datatypes_from_packages_directory_path(path: Path) -> typing.Any:
    """The path is to a folder like .compiled which contains dsdl packages"""
    return_object: typing.Any = {
        "fixed_id_messages": {},
        "variable_id_messages": [],
    }
    for package_folder_str in list(next(os.walk(path))[1]):
        package_folder = (path / package_folder_str).absolute()
        sys.path.append(str(package_folder.absolute()))
        package = importlib.import_module(package_folder.name)
        # pycyphal.util.import_submodules(package)
        # sys.path.remove(str(package_folder.absolute()))

        queue: Queue = Queue()
        queue.put(package)
        counter = 0
        try:
            while True:
                counter += 1
                module_or_class = queue.get_nowait()
                elements = inspect.getmembers(module_or_class, lambda x: inspect.ismodule(x) or inspect.isclass(x))
                for element in elements:
                    if inspect.isclass(element[1]) and not hasattr(element[1], "_deserialize_"):
                        continue
                    queue.put(element[1])
                if inspect.isclass(module_or_class):
                    _class = module_or_class
                    try:
                        model = pycyphal.dsdl.get_model(_class)
                    except Exception:
                        logger.exception("Failed to get model for %s", _class)
                        continue
                    if hasattr(_class, "_FIXED_PORT_ID_"):
                        return_object["fixed_id_messages"][str(_class._FIXED_PORT_ID_)] = {
                            "short_name": _class.__name__,
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
    for package_folder_str in list(next(os.walk(path))[1]):
        package_folder = (path / package_folder_str).absolute()
        sys.path.append(str(package_folder.absolute()))
        try:
            package = importlib.import_module(package_folder.name)
            pycyphal.util.import_submodules(package)
        except Exception:
            logger.warning("Failed to import %s", package_folder.name)
        finally:
            sys.path.remove(str(package_folder.absolute()))
