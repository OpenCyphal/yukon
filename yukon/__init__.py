import os
import sys
import typing
import logging
from pathlib import Path

if sys.version_info[:2] < (3, 10):
    raise ImportError("A newer version of Python is required")

#
# Configuring the third-party modules.
# The list of paths defined here can also be used by external packaging tools such as PyInstaller.
#
_SOURCE_PATH = os.path.abspath(os.path.dirname(__file__))
THIRDPARTY_PATH_ROOT = os.path.join(_SOURCE_PATH, "libraries")


def get_root_directory() -> Path:
    return Path(__file__).resolve().parent.parent


THIRDPARTY_PATH: typing.List[Path] = [
    # _SOURCE_PATH.parent / ".compiled" / "uavcan",
    # _SOURCE_PATH.parent / ".compiled" / "reg"
    # os.path.join(THIRDPARTY_PATH_ROOT),
    # os.path.join(THIRDPARTY_PATH_ROOT, "DearPyGui"),
]

for tp in THIRDPARTY_PATH:
    sys.path.insert(0, str(tp))

__version__: str = "0.0.1"
__version_info__: typing.Tuple[int, ...] = tuple(map(int, __version__.split(".")[:3]))
__author__ = "Zubax Robotics OÜ"
__email__ = "silver.valdvee@zubax.com"
__copyright__ = f"Copyright (c) 2022 {__author__} <{__email__}>"
__license__ = "MIT"

if sys.version_info < (3, 9):  # pragma: no cover
    raise RuntimeError("A newer version of Python is required")

logging.basicConfig(
    stream=sys.stderr,
    level=os.getenv("YUKON_LOGLEVEL", "WARNING"),
    format="%(asctime)s %(process)07d %(levelname)-3.3s: %(name)s: %(message)s",
)

# # DSDL packages are pre-compiled when the package is built, so we do not need to compile our dependencies at runtime.
dsdl_compiled_directory = str(get_root_directory() / ".compiled")
sys.path.insert(0, dsdl_compiled_directory)
