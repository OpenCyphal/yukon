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

THIRDPARTY_PATH = [
    # _SOURCE_PATH.parent / ".compiled" / "uavcan",
    # _SOURCE_PATH.parent / ".compiled" / "reg"
    # os.path.join(THIRDPARTY_PATH_ROOT),
    # os.path.join(THIRDPARTY_PATH_ROOT, "DearPyGui"),
]

for tp in THIRDPARTY_PATH:
    sys.path.insert(0, tp)

__version__: str = (Path(__file__).parent / "VERSION").read_text().strip()
__version_info__: typing.Tuple[int, ...] = tuple(map(int, __version__.split(".")[:3]))
__author__ = "Zubax Robotics OÜ"
__email__ = "silver.valdvee@zubax.com"
__copyright__ = f"Copyright (c) 2022 {__author__} <{__email__}>"
__license__ = "MIT"

if sys.version_info < (3, 9):  # pragma: no cover
    raise RuntimeError("A newer version of Python is required")

logging.basicConfig(
    stream=sys.stderr,
    level=os.getenv("KUCHERX_LOGLEVEL", "WARNING"),
    format="%(asctime)s %(process)07d %(levelname)-3.3s: %(name)s: %(message)s",
)

# DSDL packages are pre-compiled when the package is built, so we do not need to compile our dependencies at runtime.
sys.path.insert(0, str(Path(__file__).resolve().parent / ".compiled"))


def nonce():
    pass
