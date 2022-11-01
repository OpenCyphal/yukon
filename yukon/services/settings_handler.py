import typing
import logging
from pathlib import Path

from ruamel import yaml

from yukon.domain.god_state import GodState

try:
    from yaml import CLoader as Loader, CDumper as Dumper
except ImportError:
    from yaml import Loader, Dumper
from yukon.services._dumper import Dumper

logger = logging.getLogger(__name__)


def save_settings(settings_: typing.Dict, save_location: Path):
    dumper = Dumper()
    settings_dumped_string = dumper.dumps(settings_)
    with open(save_location, "w") as file:
        file.write(settings_dumped_string)


def load_settings(load_location: Path) -> typing.Dict:
    with open(load_location, "r") as f:
        return yaml.load(f.read())


def loading_settings_into_yukon(state: GodState):
    """This function makes sure that new settings that Yukon developers add end up in the settings file.

            Overridden values from configuration do of course take effect over the default values in code."""
    loaded_settings = load_settings(Path.home() / "yukon_settings.json")

    # Take extra keys and values from self.state.settings and add them to loaded_settings
    # Then make self.state.settings equal to loaded_settings
    # Now do the same but recursively for all dictionaries in self.state.settings

    def recursive_update_settings(settings: dict, loaded_settings: dict):
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
