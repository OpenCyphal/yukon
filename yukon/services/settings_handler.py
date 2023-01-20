import inspect
import json
import os
import shutil
import sys
import threading
import traceback
import typing
import logging
from uuid import uuid4
from datetime import datetime
from pathlib import Path
from collections.abc import MutableSequence

from ruamel import yaml
from ruamel.yaml.scanner import ScannerError

from yukon.domain.reactive_value_objects import ReactiveValue
from yukon.services.enhanced_json_encoder import EnhancedJSONEncoder, EnhancedJSONEncoderForSavingSettings
from yukon.services.settings_changed_actions import set_handlers_for_configuration_changes
from yukon.services.utils import add_path_to_cyphal_path, process_dsdl_path, add_path_to_sys_path
from yukon.domain.god_state import GodState

try:
    from yaml import CLoader as Loader, CDumper as Dumper
except ImportError:
    from yaml import Loader, Dumper  # type: ignore

logger = logging.getLogger(__name__)


class IncorrectConfigurationException(Exception):
    pass


def save_settings(settings_: typing.Dict, save_location: Path, state: GodState) -> None:
    serialized_settings = json.dumps(settings_, cls=EnhancedJSONEncoderForSavingSettings)
    # Compute a hash of json_traversed_settings
    # If the hash is the same as the previous hash, don't save the settings
    have_changed = False
    if state.last_settings_hash is None:
        have_changed = True
    else:
        new_hash = hash(serialized_settings)
        if not new_hash == state.last_settings_hash:
            have_changed = True
            state.last_settings_hash = new_hash
    if have_changed:
        logger.info("Saving settings to {}".format(save_location))
        json_traversed_settings = json.loads(serialized_settings)
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


def recursive_reactivize_settings(
    current_settings: ReactiveValue, parent: typing.Optional[ReactiveValue] = None
) -> None:
    # See if the call stack contains recursive_reactivize_settings, current stack element is not counted
    # is_start_of_recursion = False
    # if "recursive_reactivize_settings" in [x[3] for x in inspect.stack()[1:]]:
    #     logger.debug("Recursive call")
    # else:
    #     logger.debug("——————Reactivizing settings——————")
    #     is_start_of_recursion = True
    if parent and isinstance(current_settings, ReactiveValue):
        current_settings.parent = parent
    the_reactive_value = None
    if isinstance(current_settings, ReactiveValue):
        the_reactive_value = current_settings
        current_settings = current_settings.value
    if isinstance(current_settings, dict):
        current_settings["__id__"] = uuid4()
        logger.debug("Entering dict %r for reactivization", current_settings)
        for key, value in current_settings.items():
            if isinstance(value, (list, dict)):
                current_settings[key] = ReactiveValue(current_settings[key])
                recursive_reactivize_settings(current_settings[key], current_settings)
            elif isinstance(value, (int, float, bool, str)):
                logger.debug("Reactivizing %r", value)
                current_settings[key] = ReactiveValue(value)
                if the_reactive_value:
                    current_settings[key].parent = the_reactive_value
                logger.debug("Reactivized %r", current_settings[key])
        # For each key in current_settings, add a new key that is __id__ + previous key and value it uuid4()
        for key in list(current_settings.keys()):
            current_settings["__id__" + key] = uuid4()
    elif isinstance(current_settings, list):
        logger.debug("Entering list %r for reactivization", current_settings)
        for index, value in enumerate(current_settings):
            if isinstance(value, (list, dict)):
                current_settings[index] = ReactiveValue(current_settings[index])
                recursive_reactivize_settings(current_settings[index], current_settings)
            elif isinstance(value, (int, float, bool, str)):
                logger.debug("Reactivizing %r", value)
                current_settings[index] = ReactiveValue(value)
                if the_reactive_value:
                    current_settings[index].parent = the_reactive_value
                logger.debug("Reactivized %r", current_settings[index])
    # if is_start_of_recursion:
    #     logger.debug("——————Done reactivizing settings——————")


def loading_settings_into_yukon(state: GodState) -> None:
    """This is an initialization process for settings.

    This function makes sure that new settings that Yukon developers add end up in the settings file.

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
    if not loaded_settings:
        return
    # Take extra keys and values from self.state.settings and add them to loaded_settings
    # Then make self.state.settings equal to loaded_settings
    # Now do the same but recursively for all dictionaries in self.state.settings

    def recursive_update_settings(hardcoded_settings: dict, loaded_settings: dict) -> None:
        """
        This takes care of merging the settings that come from the settings file with the settings that come from the code.

        To be precise, it puts settings from the hardcoded_settings into the loaded_settings.

        When the hardcoded value is set to __deleted__ then it also deletes an entry from the loaded_settings dictionary. See issue #282.

        This doesn't work with any reactive values because it is run once before any reaction to the change of values are needed.
        """
        for key, value in hardcoded_settings.items():
            if value == "__deleted__":
                if key in loaded_settings:
                    del loaded_settings[key]
                continue
            if isinstance(value, dict):
                if key not in loaded_settings:
                    logger.debug(f"Adding key {key} (has dict value) to loaded_settings")
                    loaded_settings[key] = value
                else:
                    recursive_update_settings(value, loaded_settings[key])
            elif hardcoded_settings.get("__type__") == "radio":
                # Iterate over loaded_settings.get("values") and check if it already has every value from settings.get("values")
                values_in_loaded_settings = loaded_settings.get("values")
                values_in_settings = hardcoded_settings.get("values")
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

    hardcoded_settings = state.settings
    recursive_update_settings(hardcoded_settings, loaded_settings)
    loaded_settings = ReactiveValue(loaded_settings)
    recursive_reactivize_settings(loaded_settings)
    state.settings = loaded_settings
    set_handlers_for_configuration_changes(state)


def add_all_dsdl_source_paths_to_pythonpath(state: GodState) -> None:
    """This function adds all paths in state.settings.dsdl_paths to the python path."""
    dsdl_search_directories_setting = state.settings.get("DSDL search directories")
    if dsdl_search_directories_setting:
        for path_object in dsdl_search_directories_setting:
            try:
                path = path_object["value"].value
            except TypeError:
                path = path_object.value
            add_path_to_cyphal_path(path)
