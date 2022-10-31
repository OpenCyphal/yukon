import typing
from pathlib import Path

from ruamel import yaml

try:
    from yaml import CLoader as Loader, CDumper as Dumper
except ImportError:
    from yaml import Loader, Dumper
from yukon.services._dumper import Dumper


def save_settings(settings_: typing.Dict, save_location: Path):
    dumper = Dumper()
    settings_dumped_string = dumper.dumps(settings_)
    with open(save_location, "w") as file:
        file.write(settings_dumped_string)


def load_settings(load_location: Path) -> typing.Dict:
    with open(load_location, "r") as f:
        return yaml.load(f.read())
