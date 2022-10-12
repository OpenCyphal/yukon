import pytest
import subprocess
import threading
import os
from pathlib import Path
from .root_folder import get_root_folder


def yukon_thread_callback():
    root_path = get_root_folder()
    yukon_path = root_path / "yukon" / "__main__.py"
    print("Yukon path: " + str(yukon_path))
    if os.name == "nt":
        python_exe = Path(root_path / "venv" / "Scripts" / "python.exe")
    else:
        python_exe = Path(root_path / "venv" / "bin" / "python")
    subprocess.run([python_exe, yukon_path, "--port", "5001"])


@pytest.fixture
def yukon():
    yukon_thread = threading.Thread(target=yukon_thread_callback, daemon=True)
    yukon_thread.start()
    print("Yukon was launched")
