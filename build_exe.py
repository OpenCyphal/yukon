"""This utility is used for CD"""

from pathlib import Path
import logging
import subprocess


logger = logging.getLogger(__name__)
# Check if the electron directory already exists or not
if not Path("./.electron").exists():
    # Get the latest version of electron by running npm install electron
    # and then taking the electron executable from the node_modules/electron folder
    # and copying it to the relative path .electron folder

    subprocess.run(["npm", "install", "electron"], shell=True)
    electron_path = Path("./node_modules/electron/dist/")
    electron_path.rename("./.electron/")

import subprocess

subprocess.run(["pyinstaller", "--clean", "--noconfirm", "pyinstaller.spec"])
