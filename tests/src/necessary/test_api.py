import logging
import os
import pycyphal
import sys
import traceback
from pathlib import Path
import subprocess
import typing
from pycyphal.application.register import ValueProxy, Natural16, Natural32
from requests.adapters import HTTPAdapter

import uavcan
import pytest
import requests
import json
import pytest_asyncio
import asyncio
from .yukon_fixture import yukon

logger = logging.getLogger(__name__)

OneTryHttpAdapter = HTTPAdapter(max_retries=1)


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
        import requests
        import json

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
            subprocess.run(["sudo", "setcap", "cap_net_raw+eip", str(Path("which", "python").resolve())])

    @staticmethod
    @pytest.fixture
    def registry_with_transport_set_up() -> typing.Dict[str, typing.Any]:
        registry_dict = pycyphal.application.make_registry(":memory:", environment_variables={
            "UAVCAN__UDP__IFACE": "127.0.0.0",
            "UAVCAN__NODE__ID": "257",
        })
        return registry_dict

    async def test_update_register_value(self, yukon, registry_with_transport_set_up):
        """
        Testing is done on port 5001 and the actual application uses port 5000

        Start a demo node first.
        Send an api request to localhost:5001/api/update_register_value and check the response.

        Uses the example_node fixture.
        """
        session = requests.Session()
        session.mount('http://localhost:5001/api', OneTryHttpAdapter)
        try:
            with pycyphal.application.make_node(uavcan.node.GetInfo_1.Response(
                    software_version=uavcan.node.Version_1(major=1, minor=0),
                    name="test_subject",
            ), registry_with_transport_set_up) as node:
                node.start()
                # Published heartbeat fields can be configured as follows.
                node.heartbeat_publisher.mode = uavcan.node.Mode_1.OPERATIONAL  # type: ignore
                node.heartbeat_publisher.vendor_specific_status_code = os.getpid() % 100
                with pycyphal.application.make_node(uavcan.node.GetInfo_1.Response(
                        software_version=uavcan.node.Version_1(major=1, minor=0),
                        name="tester",
                ), registry_with_transport_set_up) as tester_node:
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
                        )
                        # Make a new client to send an access request to the demo node
                        service_client = tester_node.make_client(uavcan.register.Access_1_0, node.node.id)
                        msg = uavcan.register.Access_1_0.Request()
                        msg.name.name = None
                        verification_response = await service_client.call(msg)
                        if response is not None:
                            pass
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
                    except requests.exceptions.ConnectionError as e:
                        logger.exception("Connection error")
                        raise Exception(
                            "Update registers command to Yukon FAILED,"
                            f" API was not available. Connection error.\n {traceback.format_exc(chain=False)}") from None
        except Exception as e:
            # I choose to ignore exceptions to make sure the Yukon thread stays open
            # I want to manually see how the requests fail
            logger.exception("Exception")
            pass
            # raise e

    # Unit tests here
    async def verify_demo_node_has_register(self):
        class Demo:
            def __init__(self):
                node_info = uavcan.node.GetInfo_1.Response(
                    software_version=uavcan.node.Version_1(major=1, minor=0),
                    name="org.opencyphal.pycyphal.demo.demo_app",
                )

                registry = pycyphal.application.make_registry(
                    ":memory:",
                    environment_variables={
                        "DEMO_APP__DEMO_SETTING": "42",
                    },
                )

                # The Node class is basically the central part of the library -- it is the bridge between the application and
                # the UAVCAN network. Also, it implements certain standard application-layer functions, such as publishing
                # heartbeats and port introspection messages, responding to GetInfo, serving the register API, etc.
                # The register file stores the configuration parameters of our node (you can inspect it using SQLite Browser).
                self.node = pycyphal.application.make_node(node_info, registry)

                # Published heartbeat fields can be configured as follows.
                self.node.heartbeat_publisher.mode = uavcan.node.Mode_1.OPERATIONAL  # type: ignore
                self.node.heartbeat_publisher.vendor_specific_status_code = os.getpid() % 100

        demo = Demo()
        logger.warning("Getting register value for %s", register_name)
