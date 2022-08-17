"""This utility is used for CD"""
# Download the correct version of ElectronJS from https://github.com/electron/electron/releases/ for the current platform

import re
import sys
from dataclasses import dataclass
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# Check if the electron directory already exists or not
if not Path("./.electron").exists():
    is_windows = sys.platform == 'win32'
    is_arm64 = re.search(r'aarch64', sys.platform) is not None
    is_x64 = not is_arm64
    is_linux = sys.platform == 'linux'
    is_macos = sys.platform == 'darwin'

    url = "https://github.com/electron/electron/releases/latest"
    # Parse the website at url and extract the latest version number.
    # Make a get request to the url and save the response in a variable called r.
    r = requests.get(url)
    soup = BeautifulSoup(r.text, "html.parser")
    svgs = soup.find_all("svg", class_=re.compile("octicon octicon-package"))
    links = []

    for svg in svgs:
        links.append("https://github.com" + svg.parent.a["href"])

    # Choose a link from links that matches the system_info.
    # Save the link in a variable called download_link.
    download_link = None
    for link in links:
        if "electron-" not in link:
            continue
        if is_windows and is_arm64:
            if "win32" in link and "arm64.zip" in link:
                download_link = link
                break
        elif is_windows and is_x64:
            if "win32" in link and "x64.zip" in link:
                download_link = link
                break
        elif is_linux and is_arm64:
            if "linux" in link and "arm64.zip" in link:
                download_link = link
                break
        elif is_linux and is_x64:
            if "linux" in link and "x64.zip" in link:
                download_link = link
                break
        elif is_macos and is_arm64:
            if "darwin" in link and "arm64.zip" in link:
                download_link = link
                break
        elif is_macos and is_x64:
            if "darwin" in link and "x64.zip" in link:
                download_link = link
                break

    # Download the file from download_link.
    # Save the file in a variable called file.
    file = None
    if download_link is not None:
        file = requests.get(download_link)

    # Save the file to a variable called file_name.
    file_name = None
    if file is not None:
        file_name = file.headers["Content-Disposition"].split("filename=")[1]
        file_content = file.content
        file_path = "./" + file_name

    print("File name: " + file_name)

    with open(file_path, "wb") as f:
        f.write(file_content)

    # Unpack the zip at file_path into a new directory called "electron".
    # Save the path to the new directory in a variable called unzipped_path.
    unzipped_path = None
    if file_name is not None:
        import zipfile

        with zipfile.ZipFile(file_path, 'r') as zip_ref:
            zip_ref.extractall("./.electron")
        unzipped_path = "./.electron"

    # Delete the zip file.
    if file_name is not None:
        import os

        os.remove(file_path)

import subprocess

subprocess.run(["pyinstaller", "--clean", "--noconfirm", "pyinstaller.spec"])
