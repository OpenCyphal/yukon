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

from ruamel import yaml
from ruamel.yaml.scanner import ScannerError

from yukon.domain.proxy_objects import ReactiveValue
from yukon.services.enhanced_json_encoder import EnhancedJSONEncoder
from yukon.services.flash_dronecan_firmware_with_cyphal_firmware import run_dronecan_firmware_updater
from yukon.services.settings_changed_actions import set_handlers_for_configuration_changes
from yukon.services.utils import process_dsdl_path
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
        for index, value in enumerate(current_settings):
            if isinstance(value, (list, dict)):
                logger.debug("Entering list %r for modification", current_settings)
                modify_settings_values_from_a_new_copy(current_settings[index], new_settings[index])
            elif isinstance(value, ReactiveValue):
                logger.debug("Modifying %r", current_settings[index])
                current_settings[index].value = new_settings[index]
                logger.debug("Modified %r", current_settings[index])
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
    normalized_sys_path = [str(Path(path).resolve()) for path in sys.path]
    if dsdl_search_directories_setting:
        for path_object in dsdl_search_directories_setting:
            path = path_object["value"].value
            normalized_path = Path(path).resolve()
            if str(normalized_path) not in normalized_sys_path:
                process_dsdl_path(Path(normalized_path))
                sys.path.append(str(normalized_path))
                logger.debug("Added %r to sys.path", normalized_path)
        # Save the current sys.path into os.environ["PYTHONPATH"]
        separator = ";" if os.name == "nt" else ":"
        os.environ["PYTHONPATH"] = separator.join(sys.path)
