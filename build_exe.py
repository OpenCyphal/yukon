"""This utility is used for CD"""

from pathlib import Path
import logging
import subprocess
import shutil
import platform
import sys
import requests

my_os = platform.system()

logger = logging.getLogger(__name__)

do_download_electron = True
# If the --no-electron flag is passed, then we don't need to download electron
if "--no-electron" in sys.argv:
    sys.argv.remove("--no-electron")
    print("Skipping electron download...")
    do_download_electron = False
# Check if the electron directory already exists or not
if do_download_electron and not Path(".electron").exists():
    # Download the folder electronbinaries from https://files.zubax.com/products/org.opencyphal.yukon/
    # and extract it to the root directory of the project
    # This makes a new folder called electronbinaries in the root directory
    print("Downloading electron binaries... (178MB)")
    content = requests.request(
        "GET",
        "https://files.zubax.com/products/org.opencyphal.yukon/CDneeds/electronbinaries.zip",
        allow_redirects=True,
    ).content
    print("Writing electron binaries to disk...")
    with open("electronbinaries.zip", "wb") as f:
        f.write(content)
    print("Extracting electron binaries... (unpacked 400MB)")
    shutil.unpack_archive("electronbinaries.zip", ".")
    print("Deleting electron binaries zip...")
    Path("electronbinaries.zip").unlink()
    if my_os == "Linux":
        # On Linux we just copy the electron executable that we have stored in the repository
        # Find a folder in electronbinaries that starts with electron and save it into a variable
        electron_folder = [
            x for x in Path("electronbinaries").iterdir() if x.name.startswith("electron") and "linux" in x.name
        ][0]
        if electron_folder.name.endswith(".zip"):
            shutil.unpack_archive(electron_folder, electron_folder.name.replace(".zip", ""))
        electron_folder = Path(electron_folder.name.replace(".zip", ""))
        # Check if it is a zip file instead, if it is a zip file, unpack the zip file, delete the zip file and
        # copy the contents of the folder into the .electron folder
        shutil.copytree(electron_folder, ".electron")
    elif my_os == "Windows":
        # On Windows we are actually able to get the latest electron executable and package it
        # Get the latest version of electron by running npm install electron
        # and then taking the electron executable from the node_modules/electron folder
        # and copying it to the relative path .electron folder
        electron_folder = [
            x for x in Path("electronbinaries").iterdir() if x.name.startswith("electron") and "win32" in x.name
        ][0]
        if electron_folder.name.endswith(".zip"):
            shutil.unpack_archive(electron_folder, electron_folder.name.replace(".zip", ""))
        electron_folder = Path(electron_folder.name.replace(".zip", ""))
        # Copy the contents of the electron folder into the .electron folder
        shutil.copytree(electron_folder, ".electron")


subprocess.run(["pyinstaller", "--clean", "--noconfirm", "pyinstaller.spec"], check=True)
