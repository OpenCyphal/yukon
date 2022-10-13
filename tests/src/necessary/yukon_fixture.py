import pytest
import subprocess
import threading
import os
import requests
import time
from pathlib import Path
import sys
import logging
import traceback
from .root_folder import get_root_folder

logger = logging.getLogger(__name__)


def yukon_thread_callback():
    root_path = get_root_folder()
    yukon_path = root_path / "yukon" / "__main__.py"
    print("Yukon path: " + str(yukon_path))
    if os.name == "nt":
        python_exe = Path(root_path / "venv" / "Scripts" / "python.exe")
    else:
        python_exe = Path(root_path / "venv" / "bin" / "python")
    subprocess.run([python_exe, yukon_path, "--port", "5001"], env={"IS_HEADLESS": "1", "IS_DEBUG": "1"})


@pytest.fixture
def yukon():
    yukon_thread = threading.Thread(target=yukon_thread_callback, daemon=True)
    yukon_thread.start()
    time.sleep(10)
    # Send a request to localhost:5000/api/attach_udp_transport, containing json
    # {"arguments":["127.0.0.0","1200","127"]}
    # and check that the response.success == true
    try:
        response = requests.post("http://localhost:5001/api/attach_udp_transport",
                                 json={"arguments": ["127.0.0.0", "1200", "127"]})
    except requests.exceptions.ConnectionError as e:
        logger.exception("Connection error")
        raise Exception(
            f"The test failed to send an attach command to Yukon, API was not available. Connection error.\n {traceback.format_exc(chain=False)}") from None
    if response.status_code != 200:
        raise Exception("Response to the request had a different response code from 200.") from None
    else:
        response_json = response.json()
        if not response_json["success"]:
            raise Exception("Failed to attach UDP transport: " + response_json["message"]) from None
        else:
            print("The test has successfully attached a UDP transport to Yukon.")
    print("Yukon was launched")
