import subprocess
import threading
import os
import time
from pathlib import Path
import logging
import psutil
import traceback
import requests
from requests.adapters import HTTPAdapter
import pytest
from .root_folder import get_root_folder
from multiprocessing import Process
from yukon.__main__ import run_application

logger = logging.getLogger(__name__)


def kill(proc_pid):
    process = psutil.Process(proc_pid)
    for proc in process.children(recursive=True):
        proc.kill()
    process.kill()


OneTryHttpAdapter = HTTPAdapter(max_retries=1)


def create_yukon(attached_with_node_id: int):
    session = requests.Session()
    session.mount('http://localhost:5001/api', OneTryHttpAdapter)
    # First check if there is any other yukon on that port
    is_any_yukon_already_running = True
    try:
        session.post("http://localhost:5001/api/attach_udp_transport",
                     json={"arguments": ["127.0.0.0", "1200", str(attached_with_node_id)]},
                     timeout=1.0)
    except requests.exceptions.ConnectionError:
        is_any_yukon_already_running = False
    if is_any_yukon_already_running:
        raise Exception("A Yukon was already running on a testing port at the time when it had to be launched") \
            from None
    yukon_process = Process(target=run_application, args=(True, 5001, False), daemon=True)
    yukon_process.start()
    time.sleep(10)
    logger.debug("Sending a request to attach transport")
    # Send a request to localhost:5000/api/attach_udp_transport, containing json
    # {"arguments":["127.0.0.0","1200","127"]}
    # and check that the response.success == true
    try:
        response = session.post("http://localhost:5001/api/attach_udp_transport",
                                json={"arguments": ["127.0.0.0", "1200", str(attached_with_node_id)]},
                                timeout=3)
    except requests.exceptions.ConnectionError:
        logger.exception("Connection error")
        raise Exception(
            "The test failed to send an attach command to Yukon, API was not available. Connection error.\n"
            f" {traceback.format_exc(chain=False)}") from None
    if response.status_code != 200:
        raise Exception("Response to the request had a different response code from 200.") from None
    response_json = response.json()
    if not response_json["success"]:
        if "Interface already in use" not in response_json["message"]:
            raise Exception("Failed to attach UDP transport: " + response_json["message"]) from None
        else:
            logger.debug("Strangely enough, the UDP transport was already attached.")
    print("The test has successfully attached a UDP transport to Yukon.")
    print("Yukon was launched")
    return yukon_process
