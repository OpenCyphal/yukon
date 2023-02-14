import dataclasses
import enum
import importlib
import inspect
import os
import random
import sys
import typing
from pathlib import Path
from queue import Queue, Empty
import logging
from typing import TypeVar

import pydsdl
import pycyphal

import yukon

logger = logging.getLogger(__name__)


def quit_application(state: "yukon.domain.god_state.GodState") -> None:
    state.gui.gui_running = False
    state.dronecan_traffic_queues.input_queue.put_nowait(None)
    state.dronecan_traffic_queues.output_queue.put_nowait(None)
    state.queues.god_queue.put_nowait(None)


def add_path_to_cyphal_path(path: str) -> None:
    normalized_path = Path(path).resolve()
    if not normalized_path:
        return
    cyphal_path = os.environ.get("CYPHAL_PATH", None)
    if cyphal_path:
        normalized_cyphal_paths = [str(Path(path).resolve()) for path in cyphal_path]
        if str(normalized_path) not in normalized_cyphal_paths:
            os.environ["CYPHAL_PATH"] = f"{cyphal_path}{os.pathsep}{str(normalized_path)}"


def add_path_to_sys_path(path: str) -> None:
    normalized_sys_paths = [str(Path(path).resolve()) for path in sys.path]
    normalized_path = Path(path).resolve()
    if str(normalized_path) not in normalized_sys_paths:
        process_dsdl_path(Path(normalized_path))
        sys.path.append(str(normalized_path))
        logger.debug("Added %r to sys.path", normalized_path)


@dataclasses.dataclass
class Datatype:
    is_fixed_id: bool
    name: str
    class_reference: typing.Any

    def __hash__(self) -> int:
        return hash(self.name)


def get_all_datatypes(path: Path) -> typing.List[Datatype]:
    """The path is to a folder like .compiled which contains dsdl packages"""
    all_init_files = list(path.glob("**/__init__.py"))
    # List the parent directories of every __init__.py file
    init_file_packages = [init_file.parent for init_file in all_init_files]
    # Going to check contents of each file and see if it has any line which does not begin with a #
    # If it it does then we just ignore it
    init_files_with_aliases = []
    for init_file in all_init_files:
        has_aliases = False
        with open(init_file, "r") as file:
            for line in file:
                # If the line starts with # or is empty
                if line.startswith("#") or line.strip() == "":
                    continue
                else:
                    has_aliases = True
                    init_files_with_aliases.append(init_file)
                    break

    all_classes = []
    for init_file in init_files_with_aliases:
        all_classes.extend(scan_package_look_for_classes(path, init_file.relative_to(path).parent))

    all_classes = list(set(all_classes))
    return all_classes


def scan_package_look_for_classes(
    package_root: typing.Union[str, Path], package_path: typing.Union[str, Path]
) -> typing.List[Datatype]:
    if isinstance(package_path, str):
        package_path = Path(package_path)
    if isinstance(package_root, str):
        package_root = Path(package_root)
    classes = []
    add_path_to_sys_path(str(package_root))
    proper_module_path = str(package_path).replace(os.path.sep, ".")
    try:
        package = importlib.import_module(proper_module_path)
    except:
        return []
    # pycyphal.util.import_submodules(package)
    # sys.path.remove(str(package_folder.absolute()))

    queue: Queue = Queue()
    queue.put((package, None))  # No previous class
    counter = 0
    try:
        while True:
            counter += 1
            module_or_class, previous_module_or_class = queue.get_nowait()
            # Get all modules and classes that are seen in the imported module
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
                classes.append(Datatype(hasattr(_class, "_FIXED_PORT_ID_"), model.full_name, _class))
    except Empty:
        pass
    return classes


def get_datatype_return_dto(all_classes: typing.List[Datatype]) -> typing.Any:
    return_object: typing.Any = {
        "fixed_id_messages": {},
        "variable_id_messages": [],
    }
    for datatype in all_classes:
        try:
            if datatype.is_fixed_id:
                return_object["fixed_id_messages"][str(datatype.class_reference._FIXED_PORT_ID_)] = {
                    "short_name": datatype.class_reference.__name__,
                    "name": datatype.name,
                }
            else:
                return_object["variable_id_messages"].append(
                    {
                        "short_name": datatype.class_reference.__name__,
                        "name": datatype.name,
                    }
                )
        except Exception as e:
            logger.error(str(e))
            logger.exception("Failed to get datatype for %s", datatype)
    return return_object


# The user will provide only primitive values, all composite types are automatically generated around them
class PrimitiveFieldType(enum.Enum):
    Real = 0
    UnsignedInteger = 1
    Integer = 2
    Boolean = 3
    String = 4
    Unknown = 5


def determine_primitive_field_type(field: pydsdl.Field) -> PrimitiveFieldType:
    """
    Determine the primitive field type of a field

    :param field: The field to determine the primitive field type of
    :return: The primitive field type
    """
    datatype = field.data_type
    if isinstance(field.data_type, pydsdl.ArrayType):
        datatype = field.data_type.element_type
    if isinstance(datatype, pydsdl.PrimitiveType):
        if isinstance(datatype, pydsdl.SignedIntegerType):
            return PrimitiveFieldType.Integer
        elif isinstance(datatype, pydsdl.UnsignedIntegerType):
            return PrimitiveFieldType.UnsignedInteger
        elif isinstance(datatype, pydsdl.FloatType):
            return PrimitiveFieldType.Real
        elif isinstance(datatype, pydsdl.BooleanType):
            return PrimitiveFieldType.Boolean
        elif isinstance(datatype, pydsdl.StringType):
            return PrimitiveFieldType.String
    return PrimitiveFieldType.Unknown


@dataclasses.dataclass
class SimplifiedFieldDTO:
    field_name: str
    field_type: PrimitiveFieldType
    is_array: bool
    short_name: str
    model_name: str


def get_all_fields_recursive(
    field: pydsdl.Field,
    properties: typing.List[SimplifiedFieldDTO],
    previous_components: typing.List[str],
    model_name: str,
    depth: int = 0,
) -> None:
    """
    Recursively get all fields of a composite type. Fills in the properties list.

    :param field: The field to get the fields of
    :param properties: The list of properties to append to
    :param previous_components: The list of previous components to append to, components make up the full path
    :param depth: The depth of the recursion

    :return: None
    """
    try:
        previous_components.append(field.name)
        for field in field.data_type.fields:
            if not isinstance(field, pydsdl.PaddingField):
                # print(f"{'  ' * depth}{field.name}")
                # This is where the attribute error comes from when it's not a compound type, that's ok
                previous_path = ".".join(previous_components)
                path = previous_path + "." + field.name
                if isinstance(field.data_type, pydsdl.PrimitiveType):
                    properties.append(
                        SimplifiedFieldDTO(path, determine_primitive_field_type(field), False, field.name, model_name)
                    )
                elif isinstance(field.data_type, pydsdl.ArrayType):
                    properties.append(
                        SimplifiedFieldDTO(path, determine_primitive_field_type(field), True, field.name, model_name)
                    )
                else:
                    get_all_fields_recursive(field, properties, previous_components, model_name, depth + 1)
    except AttributeError as e:
        # No longer a CompositeType, a leaf node of some other type
        pass


def get_all_field_dtos(obj: typing.Any) -> typing.List[SimplifiedFieldDTO]:
    """
    Recursively get all properties of a composite type

    :param obj: The object to get the properties of
    """
    model = pycyphal.dsdl.get_model(obj)
    properties = []
    for field in model.fields_except_padding:
        if isinstance(field.data_type, pydsdl.PrimitiveType):
            properties.append(
                SimplifiedFieldDTO(
                    field.name, determine_primitive_field_type(field), False, field.name, str(model) + "." + field.name
                )
            )
        elif isinstance(field.data_type, pydsdl.ArrayType):
            properties.append(
                SimplifiedFieldDTO(
                    field.name, determine_primitive_field_type(field), True, field.name, str(model) + "." + field.name
                )
            )
        else:
            get_all_fields_recursive(field, properties, [], str(model))
    return properties


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
