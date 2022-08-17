#!/usr/bin/env python3
#
# Copyright (C) 2018 Zubax Robotics OU
#
# This file is part of Kucher.
# Kucher is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
# Kucher is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
# of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.
# You should have received a copy of the GNU General Public License along with Kucher.
# If not, see <http://www.gnu.org/licenses/>.
#
# Author: Pavel Kirienko <pavel.kirienko@zubax.com>
#

#
# This is a spec file for PyInstaller.
# Docs: https://pyinstaller.readthedocs.io/en/stable/spec-files.html
#

import os
import sys
import glob
import typing

sys.path.insert(0, os.getcwd())

import kucherx

try:
    # noinspection PyUnresolvedReferences
    sys.getwindowsversion()
    RUNNING_ON_WINDOWS = True
except AttributeError:
    RUNNING_ON_WINDOWS = False

name = 'KucherX'

paths = kucherx.THIRDPARTY_PATH + [
    'kucherx',
]

# Pack up the entire source tree with the redistributed archive.
# It adds a bit of redundant data to the resulting package, but greatly simplifies maintenance and
# ensures that the layout used for development exactly reflects the environment used in production.
# The added size penalty is insignificant.
datas = [
    ('kucherx', '.')
]


def detect_hidden_imports() -> typing.List[str]:
    """
    Makes a brute-force search for ALL python files, including third-party packages,
    and transforms that into a list of Python module names that is then fed to PyInstaller.
    This way we may also end up with unused stuff, but it's easier to maintain.
    """
    all_sources = glob.glob('kucherx/**/*', recursive=True)

    out = set()
    for s in all_sources:
        module = s.replace('.py', '').replace(os.sep, '.').replace('.__init__', '')
        out.add(module)

    return list(out)


detected_hidden_imports = detect_hidden_imports()
detected_hidden_imports += "can.interfaces.slcan" # This didn't actually make it work, importing it randomly did.
detected_hidden_imports += "can.interfaces.virtual"
# noinspection PyUnresolvedReferences
a = Analysis(['kucherx/__main__.py'],
             pathex=paths,
             binaries=[],
             datas=datas,
             hiddenimports=detected_hidden_imports,
             hookspath=[],
             runtime_hooks=[],
             excludes=[],
             win_no_prefer_redirects=False,
             win_private_assemblies=False,
             cipher=None)

# noinspection PyUnresolvedReferences
pyz = PYZ(a.pure, a.zipped_data,
          cipher=None)

# noinspection PyUnresolvedReferences
exe = EXE(pyz,
          a.scripts,
          a.binaries,
          a.zipfiles,
          a.datas,
          name=name,
          debug=True,
          strip=False,
          upx=False,
          runtime_tmpdir=None,
          console=True)
