import os
import sys

if sys.version_info[:2] < (3, 10):
    raise ImportError("A newer version of Python is required")

#
# Configuring the third-party modules.
# The list of paths defined here can also be used by external packaging tools such as PyInstaller.
#
_SOURCE_PATH = os.path.abspath(os.path.dirname(__file__))
THIRDPARTY_PATH_ROOT = os.path.join(_SOURCE_PATH, "libraries")

THIRDPARTY_PATH = [
    # os.path.join(THIRDPARTY_PATH_ROOT),
    # os.path.join(THIRDPARTY_PATH_ROOT, "DearPyGui"),
]

for tp in THIRDPARTY_PATH:
    sys.path.insert(0, tp)