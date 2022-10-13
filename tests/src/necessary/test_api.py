import json
import logging
import os
import subprocess
import sys
import traceback
import typing
from pathlib import Path

import pycyphal
import pycyphal.application
import pytest
import requests
from requests.adapters import HTTPAdapter

import uavcan
from .create_yukon import create_yukon

logger = logging.getLogger(__name__)

OneTryHttpAdapter = HTTPAdapter(max_retries=1)


def get_registry_with_transport_set_up(node_id: int) -> typing.Dict[str, typing.Any]:
    registry_dict = pycyphal.application.make_registry(":memory:", environment_variables={
        "UAVCAN__UDP__IFACE": "127.0.0.0",
        "UAVCAN__NODE__ID": "257",
    })
    return registry_dict


class TestBackendTestSession:
    @staticmethod
    @pytest.fixture(scope="session")
    def state():
        return {
            "demo_node": None,
            "tester_node": None
        }

    async def test_get_socketcan_ports(self):
        """Send an api request to localhost:5000/api/get_socketcan_ports and check the response"""
        response = requests.post("http://localhost:5001/api/get_socketcan_ports")
        if response.status_code != 200:
            return False
        try:
            response_ports = json.loads(response.text)
        except json.decoder.JSONDecodeError:
            return False
        ports_array = response_ports.get("ports")
        logger.debug("ports_array: %s", ports_array)
        if not ports_array:
            return False
        return True

    @staticmethod
    @pytest.fixture(scope="session")
    def setup_udp_capability() -> None:
        if sys.platform.startswith("linux"):
            # Enable packet capture for the Python executable. This is necessary for testing the UDP capture capability.
            # It can't be done from within the test suite because it has to be done before the interpreter is started.
            subprocess.run(["sudo", "setcap", "cap_net_raw+eip", str(Path("which", "python").resolve())], check=True)

    async def test_update_register_value(self):
        """
        Testing is done on port 5001 and the actual application uses port 5000

        Start a demo node first.
        Send an api request to localhost:5001/api/update_register_value and check the response.

        Uses the example_node fixture.
        """
        yukon_process = create_yukon(124)
        session = requests.Session()
        session.mount('http://localhost:5001/api', OneTryHttpAdapter)
        with pycyphal.application.make_node(uavcan.node.GetInfo_1.Response(
                software_version=uavcan.node.Version_1(major=1, minor=0),
                name="test_subject",
        ), get_registry_with_transport_set_up(126)) as node:
            node.start()
            # Published heartbeat fields can be configured as follows.
            node.heartbeat_publisher.mode = uavcan.node.Mode_1.OPERATIONAL  # type: ignore
            node.heartbeat_publisher.vendor_specific_status_code = os.getpid() % 100
            with pycyphal.application.make_node(uavcan.node.GetInfo_1.Response(
                    software_version=uavcan.node.Version_1(major=1, minor=0),
                    name="tester",
            ), get_registry_with_transport_set_up(127)) as tester_node:
                tester_node.start()
                try:
                    response = session.post(
                        "http://localhost:5001/api/update_register_value",
                        json={
                            "arguments": [
                                "analog.rcpwm.deadband",
                                {"real32": {"value": [0.00004599999873689376]},
                                 "_meta_": {"mutable": True, "persistent": True}},
                                125,
                            ]
                        },
                        timeout=3.0
                    )
                    # Make a new client to send an access request to the demo node
                    service_client = tester_node.make_client(uavcan.register.Access_1_0, node.node.id)
                    msg = uavcan.register.Access_1_0.Request()
                    msg.name.name = None
                    verification_response = await service_client.call(msg)
                    if verification_response is not None:
                        logger.debug("Response: %s", verification_response)
                    if response.status_code != 200:
                        return False
                    try:
                        response_update = json.loads(response.text)
                    except json.decoder.JSONDecodeError:
                        return False
                    logger.debug("response_update: %s", response_update)
                    if response_update.get("success") is not True:
                        return False
                    return True
                except (requests.exceptions.ConnectionError, requests.exceptions.ReadTimeout):
                    logger.exception("Connection error")
                    raise Exception(
                        "Update registers command to Yukon FAILED,"
                        f" API was not available. Connection error.\n {traceback.format_exc(chain=False)}") from None
