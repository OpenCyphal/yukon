import os
import sys
import typing
import logging
from pathlib import Path

from ruamel import yaml

from yukon.services.utils import process_dsdl_path
from yukon.domain.god_state import GodState

try:
    from yaml import CLoader as Loader, CDumper as Dumper
except ImportError:
    from yaml import Loader, Dumper  # type: ignore

logger = logging.getLogger(__name__)


def save_settings(settings_: typing.Dict, save_location: Path) -> None:
    settings_dumped_string = yaml.dump(settings_)
    with open(save_location, "w") as file:
        file.write(settings_dumped_string)


def load_settings(load_location: Path) -> typing.Any:
    try:
        with open(load_location, "r") as f:
            return yaml.load(f.read())
    except FileNotFoundError:
        logger.info("No settings file found.")
        return None


def loading_settings_into_yukon(state: GodState) -> None:
    """This function makes sure that new settings that Yukon developers add end up in the settings file.

    Overridden values from configuration do of course take effect over the default values in code."""
    loaded_settings = load_settings(Path.home() / "yukon_settings.yaml")
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
        state.settings = loaded_settings


def add_all_dsdl_paths_to_pythonpath(state: GodState) -> None:
    """This function adds all paths in state.settings.dsdl_paths to the python path."""
    for path_object in state.settings["DSDL search directories"]:
        path = path_object["value"]
        if path not in sys.path:
            process_dsdl_path(Path(path))
            sys.path.append(path)
    # Save the current sys.path into os.environ["PYTHONPATH"]
    os.environ["PYTHONPATH"] = ":".join(sys.path)
