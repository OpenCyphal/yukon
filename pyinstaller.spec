#!/usr/bin/env python3
#
# Copyright (C) 2018 Zubax Robotics OU
#
# This file is part of Yukon.
# Yukon is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
# Yukon is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
# of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.
# You should have received a copy of the GNU General Public License along with Yukon.
# If not, see <http://www.gnu.org/licenses/>.
#
# Author: Silver Valdvee <silver.valdvee@zubax.com>
#

#
# This is a spec file for PyInstaller.
# Docs: https://pyinstaller.readthedocs.io/en/stable/spec-files.html
#

import os
import sys
import glob
import typing
import sysconfig
import platform
from pathlib import Path

my_os = platform.system()

sys.path.insert(0, os.getcwd())

name = "Yukon"

# Pack up the entire source tree with the redistributed archive.
# It adds a bit of redundant data to the resulting package, but greatly simplifies maintenance and
# ensures that the layout used for development exactly reflects the environment used in production.
# The added size penalty is insignificant.
datas = [("yukon", "yukon")]
if Path(".electron").exists():
    datas += [(".electron", "electron")]

if my_os == "Linux":
    datas += [("venv/lib/python3*/site-packages/libpcap", "libpcap")]

datas += [(".compiled", ".compiled")]


def detect_hidden_imports() -> typing.List[str]:
    """
    Makes a brute-force search for ALL python files, including third-party packages,
    and transforms that into a list of Python module names that is then fed to PyInstaller.
    This way we may also end up with unused stuff, but it's easier to maintain.
    """
    all_sources = glob.glob("yukon/**/*", recursive=True)

    out = set()
    for s in all_sources:
        module = s.replace(".py", "").replace(os.sep, ".").replace(".__init__", "")
        out.add(module)

    return list(out)


detected_hidden_imports = detect_hidden_imports()
detected_hidden_imports += ["can.interfaces"]
detected_hidden_imports += ["pkg_about"]
detected_hidden_imports += [
    "__future__",
    "pkg_resources",
    "sched",
    "multiprocessing",
    "sqlite3",
    "serial",
    "python-can",
    "dronecan",
    "wrapt",
]

site_packages = Path(sysconfig.get_paths()["purelib"])

datas += [(site_packages / "dronecan", "dronecan")]
datas += [(site_packages / "pydsdl", "pydsdl")]
datas += [(site_packages / "pycyphal", "pycyphal")]
datas += [(site_packages / "nunavut", "nunavut")]
datas += [(site_packages / "can", "can")]

if my_os == "Linux":
    detected_hidden_imports += ["libpcap"]
# noinspection PyUnresolvedReferences
a = Analysis(
    ["yukon/__main__.py"],
    pathex=None,
    binaries=[],
    datas=datas,
    hiddenimports=detected_hidden_imports + ["sentry_sdk"] + ["importlib_resources"],
    hookspath=[],
    runtime_hooks=[],
    excludes=["uavcan", "reg", "sirius_cyber_corp", "zubax", "zubax_internet", "dronecan", "can", "pydsdl", "nunavut"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
)


# noinspection PyUnresolvedReferences
pyz = PYZ(a.pure, a.zipped_data, cipher=None)

splash = Splash(
    "docs/splash-cyphal.png",
    binaries=a.binaries,
    datas=a.datas,
    text_pos=None,
    text_size=12,
    minify_script=True,
    always_on_top=True,
)


# noinspection PyUnresolvedReferences
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    splash,
    splash.binaries,
    [],
    name=name,
    debug=False,
    strip=False,
    upx=False,
    runtime_tmpdir=None,
    console=False,
    icon="icon_128_128.png",
)
