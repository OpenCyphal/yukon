import subprocess
import threading
import os
import time
from pathlib import Path
import logging
import traceback
import requests
from requests.adapters import HTTPAdapter
import pytest
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
    environment_variables = os.environ.copy()
    environment_variables.update({"IS_HEADLESS": "1"})
    logger.debug("Going to execute the Yukon python exe now with the following environment variables: %s",
                 environment_variables)
    subprocess.run([python_exe, yukon_path, "--port", "5001"], env=environment_variables, check=True)


OneTryHttpAdapter = HTTPAdapter(max_retries=1)


@pytest.fixture
def yukon_fixture():
    session = requests.Session()
    session.mount('http://localhost:5001/api', OneTryHttpAdapter)
    yukon_thread = threading.Thread(target=yukon_thread_callback, daemon=True)
    yukon_thread.start()
    logger.debug("Yukon thread started")
    time.sleep(10)
    logger.debug("Sending a request to attach transport")
    # Send a request to localhost:5000/api/attach_udp_transport, containing json
    # {"arguments":["127.0.0.0","1200","127"]}
    # and check that the response.success == true
    try:
        response = session.post("http://localhost:5001/api/attach_udp_transport",
                                json={"arguments": ["127.0.0.0", "1200", "127"]})
    except requests.exceptions.ConnectionError:
        logger.exception("Connection error")
        raise Exception(
            "The test failed to send an attach command to Yukon, API was not available. Connection error.\n"
            f" {traceback.format_exc(chain=False)}") from None
    if response.status_code != 200:
        raise Exception("Response to the request had a different response code from 200.") from None
    response_json = response.json()
    if not response_json["success"]:
        raise Exception("Failed to attach UDP transport: " + response_json["message"]) from None
    print("The test has successfully attached a UDP transport to Yukon.")
    print("Yukon was launched")
