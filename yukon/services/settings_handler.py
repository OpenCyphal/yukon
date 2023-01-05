import inspect
import json
import os
import shutil
import sys
import threading
import typing
import logging
from datetime import datetime
from pathlib import Path
from collections.abc import MutableSequence

from ruamel import yaml
from ruamel.yaml.scanner import ScannerError

from yukon.domain.reactive_proxy_objects import ReactiveValue
from yukon.services.enhanced_json_encoder import EnhancedJSONEncoder
from yukon.services.settings_changed_actions import set_handlers_for_configuration_changes
from yukon.services.utils import process_dsdl_path, add_path_to_sys_path
from yukon.domain.god_state import GodState

try:
    from yaml import CLoader as Loader, CDumper as Dumper
except ImportError:
    from yaml import Loader, Dumper  # type: ignore

logger = logging.getLogger(__name__)


class IncorrectConfigurationException(Exception):
    pass


def save_settings(settings_: typing.Dict, save_location: Path) -> None:
    json_traversed_settings = json.loads(json.dumps(settings_, cls=EnhancedJSONEncoder))
    settings_dumped_string = yaml.dump(json_traversed_settings)
    with open(save_location, "w") as file:
        file.write(settings_dumped_string)


def load_settings(load_location: Path) -> typing.Any:
    try:
        with open(load_location, "r") as f:
            return yaml.load(f.read())
    except FileNotFoundError:
        logger.info("No settings file found.")
        return None
    except ScannerError as e:
        logger.error(
            "Error parsing yaml of configuration file "
            "{}: {}".format(
                e.problem_mark,
                e.problem,
            )
        )
        raise IncorrectConfigurationException()


# logger.setLevel(logging.DEBUG)
def equals_dict(object1: dict, object2: dict) -> bool:
    """Check that all keys in object1 are in object2 and that the values are equal"""
    if not isinstance(object1, dict) or not isinstance(object2, dict):
        return False
    for key, value in object1.items():
        if key not in object2:
            return False
        object2_value = object2[key]
        if isinstance(value, dict):
            if not equals_dict(value, object2_value):
                return False
        elif isinstance(value, list):
            if not equals_list(value, object2_value):
                return False
        elif isinstance(value, ReactiveValue):
            if isinstance(object2_value, ReactiveValue):
                if value.value != object2_value.value:
                    return False
            elif isinstance(object2_value, (int, float, str, bool)):
                if value.value != object2_value:
                    return False
        elif isinstance(value, (int, float, str, bool)):
            if isinstance(object2_value, ReactiveValue):
                if value != object2_value.value:
                    return False
            elif isinstance(object2_value, (int, float, str, bool)):
                if value != object2_value:
                    return False
    return True


def equals_list(list1: list, list2: list) -> bool:
    """Check that all elements in list1 are in list2, use equals_dict to check if a dict is in both lists"""
    if not isinstance(list1, list) or not isinstance(list2, list):
        return False
    for element in list1:
        if isinstance(element, dict):
            if not any([equals_dict(element, list2_element) for list2_element in list2]):
                return False
        elif isinstance(element, list):
            if not any([equals_list(element, list2_element) for list2_element in list2]):
                return False
        elif isinstance(element, (int, float, str, bool)):
            value_found = False
            for list2_element in list2:
                if isinstance(list2_element, (int, float, str, bool)):
                    if element == list2_element:
                        break
                elif isinstance(list2_element, ReactiveValue):
                    if element == list2_element.value:
                        break
            if not value_found:
                return False
        elif isinstance(element, ReactiveValue):
            value_found = False
            for list2_element in list2:
                if isinstance(list2_element, ReactiveValue):
                    if element.value == list2_element.value:
                        value_found = True
                        break
                elif isinstance(list2_element, (int, float, str, bool)):
                    if element.value == list2_element:
                        value_found = True
                        break
            if not value_found:
                return False
    return True


def modify_settings_values_from_a_new_copy(
    current_settings: typing.Union[dict, list], new_settings: typing.Union[dict, list]
) -> None:
    is_start_of_recursion = False
    if "modify_settings_values_from_a_new_copy" in [x[3] for x in inspect.stack()[1:]]:
        logger.debug("Recursive call")
    else:
        logger.debug("——————Modifying settings——————")
        is_start_of_recursion = True
    if isinstance(current_settings, dict):
        for key, value in current_settings.items():
            if isinstance(value, (list, dict)):
                logger.debug("Entering dict %r for modification", current_settings)
                modify_settings_values_from_a_new_copy(current_settings[key], new_settings[key])
            elif isinstance(value, ReactiveValue):
                logger.debug("Modifying %r", value)
                current_settings[key].value = new_settings[key]
                logger.debug("Modified %r", current_settings[key])
    elif isinstance(current_settings, list):
        elements_to_remove = []
        for index, value in enumerate(current_settings):
            # Remove all ReactiveValues in current_settings that don't have a value that is in new_settings
            if isinstance(value, ReactiveValue) and value.value not in new_settings:
                logger.info("Planning to remove %r", value)
                elements_to_remove.append(value)
            # Check if the value is in new_settings, if not remove it, check using equals_dict and equals_list
            if isinstance(value, (list, dict)) and not any(
                [
                    equals_dict(value, new_settings_element)
                    if isinstance(value, dict)
                    else equals_list(value, new_settings_element)
                    for new_settings_element in new_settings
                ]
            ):
                logger.info("Planning to remove %r", value)
                elements_to_remove.append(value)
            if isinstance(value, (list, dict)):
                logger.debug("Entering list %r for modification", current_settings)
                if len(current_settings) == len(
                    new_settings
                ):  # This will break when the user is fast with modifying the settings
                    modify_settings_values_from_a_new_copy(current_settings[index], new_settings[index])
            # elif isinstance(value, ReactiveValue):
            # Remove all items in the list that are ReactiveValues
            # logger.debug("Modifying %r", current_settings[index])
            # current_settings[index].value = new_settings[index]
            # elements_to_remove.append(value)
            # logger.debug("Modified %r", current_settings[index])
        if len(elements_to_remove) > 0:
            logger.debug("Removing %r", elements_to_remove)
        current_settings_length_before_removal = len(current_settings)
        for value in elements_to_remove:
            current_settings.remove(value)
        if len(elements_to_remove) > 0:
            assert len(current_settings) == current_settings_length_before_removal - len(elements_to_remove)
        # Insert all elements from new_settings that are int, float, bool, str and that don't exist in current_settings
        for value in new_settings:
            value_exists = False
            for current_value in current_settings:
                if isinstance(current_value, ReactiveValue):
                    if isinstance(value, (int, float, bool, str)):
                        if current_value.value == value:
                            value_exists = True
                            break
                    elif isinstance(value, ReactiveValue):
                        if current_value.value == value.value:
                            value_exists = True
                            break
                if isinstance(current_value, (int, float, bool, str)):
                    if isinstance(value, (int, float, bool, str)):
                        if current_value == value:
                            value_exists = True
                            break
                    elif isinstance(value, ReactiveValue):
                        if current_value == value.value:
                            value_exists = True
                            break
                elif isinstance(current_value, dict) and equals_dict(current_value, value):
                    value_exists = True
                    break
                elif isinstance(current_value, list) and equals_list(current_value, value):
                    value_exists = True
                    break
            if not value_exists:
                logger.debug("Inserting %r", value)
                if isinstance(value, (int, float, bool, str)):
                    current_settings.append(ReactiveValue(value))
                else:
                    current_settings.append(value)
                    recursive_reactivize_settings(value)
    if is_start_of_recursion:
        logger.debug("——————Done modifying settings——————")


def recursive_reactivize_settings(current_settings: typing.Union[dict, list]) -> None:
    # See if the call stack contains recursive_reactivize_settings, current stack element is not counted
    is_start_of_recursion = False
    if "recursive_reactivize_settings" in [x[3] for x in inspect.stack()[1:]]:
        logger.debug("Recursive call")
    else:
        logger.debug("——————Reactivizing settings——————")
        is_start_of_recursion = True
    if isinstance(current_settings, dict):
        logger.debug("Entering dict %r for reactivization", current_settings)
        for key, value in current_settings.items():
            if isinstance(value, (list, dict)):
                recursive_reactivize_settings(current_settings[key])
            elif isinstance(value, (int, float, bool, str)):
                logger.debug("Reactivizing %r", value)
                current_settings[key] = ReactiveValue(value)
                logger.debug("Reactivized %r", current_settings[key])
    elif isinstance(current_settings, list):
        logger.debug("Entering list %r for reactivization", current_settings)
        for index, value in enumerate(current_settings):
            if isinstance(value, (list, dict)):
                recursive_reactivize_settings(current_settings[index])
            elif isinstance(value, (int, float, bool, str)):
                logger.debug("Reactivizing %r", value)
                current_settings[index] = ReactiveValue(value)
                logger.debug("Reactivized %r", current_settings[index])
    if is_start_of_recursion:
        logger.debug("——————Done reactivizing settings——————")


def loading_settings_into_yukon(state: GodState) -> None:
    """This function makes sure that new settings that Yukon developers add end up in the settings file.

    Overridden values from configuration do of course take effect over the default values in code."""
    settings_file_path = Path.home() / "yukon_settings.yaml"
    loaded_settings = None
    try:
        loaded_settings = load_settings(settings_file_path)
    except IncorrectConfigurationException:
        # Rename the file at settings_file_path to settings_file_path + "_old" + datetime.now()
        shutil.move(settings_file_path, str(settings_file_path) + "_old" + str(datetime.now()))
        logger.error(
            "Settings file was corrupted. Renamed to " + str(settings_file_path) + "_old" + str(datetime.now())
        )
    if loaded_settings:
        # Take extra keys and values from self.state.settings and add them to loaded_settings
        # Then make self.state.settings equal to loaded_settings
        # Now do the same but recursively for all dictionaries in self.state.settings

        def recursive_update_settings(settings: dict, loaded_settings: dict) -> None:
            for key, value in settings.items():
                if isinstance(value, dict):
                    if key not in loaded_settings:
                        logger.debug(f"Adding key {key} (has dict value) to loaded_settings")
                        loaded_settings[key] = value
                    else:
                        recursive_update_settings(value, loaded_settings[key])
                elif settings.get("__type__") == "radio":
                    # Iterate over loaded_settings.get("values") and check if it already has every value from settings.get("values")
                    values_in_loaded_settings = loaded_settings.get("values")
                    values_in_settings = settings.get("values")
                    if isinstance(values_in_loaded_settings, MutableSequence) and isinstance(
                        values_in_settings, MutableSequence
                    ):
                        for value in values_in_settings:
                            if value not in values_in_loaded_settings:
                                logger.debug(f"Adding value {value} to loaded_settings")
                                values_in_loaded_settings.append(value)
                else:
                    if key not in loaded_settings:
                        logger.debug(f"Adding key {key} to loaded_settings")
                        loaded_settings[key] = value

        recursive_update_settings(state.settings, loaded_settings)
        recursive_reactivize_settings(loaded_settings)
        state.settings = loaded_settings
        set_handlers_for_configuration_changes(state)


def add_all_dsdl_paths_to_pythonpath(state: GodState) -> None:
    """This function adds all paths in state.settings.dsdl_paths to the python path."""
    dsdl_search_directories_setting = state.settings.get("DSDL search directories")
    if dsdl_search_directories_setting:
        for path_object in dsdl_search_directories_setting:
            path = path_object["value"].value
            add_path_to_sys_path(path)
        # Save the current sys.path into os.environ["PYTHONPATH"]
        separator = ";" if os.name == "nt" else ":"
        os.environ["PYTHONPATH"] = separator.join(sys.path)
