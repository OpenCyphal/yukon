import asyncio
import json
import logging
import os
import subprocess
import sys
import traceback
import typing
from pathlib import Path
import math

import pycyphal
import pycyphal.application
import pytest
import requests
from pycyphal.application.register import ValueProxy, Real32
from requests.adapters import HTTPAdapter
import aiohttp

import uavcan
from services.enhanced_json_encoder import EnhancedJSONEncoder
from services.get_ports import get_socketcan_ports
from services.value_utils import explode_value
from .create_yukon import create_yukon

logger = logging.getLogger(__name__)

OneTryHttpAdapter = HTTPAdapter(max_retries=1)


def get_registry_with_transport_set_up(node_id: int) -> typing.Dict[str, typing.Any]:
    registry_dict = pycyphal.application.make_registry(
        ":memory:",
        environment_variables={
            "UAVCAN__UDP__IFACE": "127.0.0.0",
            "UAVCAN__NODE__ID": str(node_id),
        },
    )
    return registry_dict


def make_test_node_info(name: str) -> uavcan.node.GetInfo_1.Response:
    node_info = uavcan.node.GetInfo_1.Response(
        software_version=uavcan.node.Version_1(major=1, minor=0),
        name=name,
    )
    return node_info


class TestBackendTestSession:
    @staticmethod
    @pytest.fixture(scope="session")
    def state():
        return {"demo_node": None, "tester_node": None}

    @staticmethod
    @pytest.fixture(scope="session")
    def setup_udp_capability() -> None:
        if sys.platform.startswith("linux"):
            # Enable packet capture for the Python executable. This is necessary for testing the UDP capture capability.
            # It can't be done from within the test suite because it has to be done before the interpreter is started.
            subprocess.run(["sudo", "setcap", "cap_net_raw+eip", str(Path("which", "python").resolve())], check=True)

    async def test_reread_register_value(self):
        """0. Make a test_subject node and a test_node node.
        1. Set the value of analog.rcpwm.deadband to 0.1.
        2. Initialize Yukon (create_yukon).
        3. Use registry.setdefault to set the value of analog.rcpwm.deadband to 0.2.
        4. At this point, a request should be made to localhost:5001/api/get_avatars,
         the node with node_id corresponding to
         test_subject should have the register analog.rcpwm.deadband with the value of 0.1, because it doesn't reread
         automatically.
        5. Send a request to reread the register.
        6. Read the value of analog.rcpwm.deadband and check that it is 0.2.
         Do this by making a request to localhost:5000/api/get_avatars. The avatar that has
         the node id of the test_subject node should have a register named analog.rcpwm.deadband with a value of 0.2.
        """
        try:

            with pycyphal.application.make_node(
                    make_test_node_info("test_subject"), get_registry_with_transport_set_up(126)
            ) as node, pycyphal.application.make_node(
                make_test_node_info("tester"),
                get_registry_with_transport_set_up(127),
            ) as tester_node:
                # Published heartbeat fields can be configured as follows.
                node.heartbeat_publisher.mode = uavcan.node.Mode_1.OPERATIONAL  # type: ignore
                node.heartbeat_publisher.vendor_specific_status_code = os.getpid() % 100
                node.registry.setdefault("analog.rcpwm.deadband", ValueProxy(Real32(0.1)))
                tester_node.heartbeat_publisher.mode = uavcan.node.Mode_1.OPERATIONAL  # type: ignore
                tester_node.heartbeat_publisher.vendor_specific_status_code = (os.getpid() - 1) % 100
                await create_yukon(124)
                await asyncio.sleep(7)  # An extra wait to make sure that Yukon has read the registers by now.
                node.registry["analog.rcpwm.deadband"] = ValueProxy(Real32(0.2))
                node.start()
                tester_node.start()
                session = aiohttp.ClientSession()
                avatars_response = await session.get("http://localhost:5001/api/get_avatars", timeout=3)
                if avatars_response.status != 200:
                    return False
                avatars = await avatars_response.json()

                for avatar in avatars["avatars"]:
                    if avatar["node_id"] == node.id:
                        correct_avatar = avatar
                assert correct_avatar
                assert math.isclose(
                    correct_avatar["registers_exploded_values"]["analog.rcpwm.deadband"]["real32"]["value"][0],
                    0.1, abs_tol=0.0001)
                correct_avatar = None
                avatars = None
                await session.get("http://localhost:5001/api/reread_registers",
                                  json={"arguments": [{node.id: {"analog.rcpwm.deadband": True}}]}, timeout=3)
                await asyncio.sleep(1)  # Give it some time to make sure it finishes the reread
                avatars_response = await session.get("http://localhost:5001/api/get_avatars", timeout=3)
                if avatars_response.status != 200:
                    return False
                avatars = await avatars_response.json()
                assert avatars
                for avatar in avatars["avatars"]:
                    if avatar["node_id"] == node.id:
                        correct_avatar = avatar
                assert correct_avatar
                assert math.isclose(
                    correct_avatar["registers_exploded_values"]["analog.rcpwm.deadband"]["real32"]["value"][0],
                    0.2, abs_tol=0.0001)
                correct_avatar = None
                avatars = None
        finally:
            if session:
                await session.close()

    async def test_update_register_value(self):
        """Initialize Yukon. Make a test_subject and a tester node.
        1. Set the value of analog.rcpwm.deadband to 0.00004699999873689376.
        2. Make a request to localhost:5001/api/update_register_value, this will make Yukon set the register value.
        3. Use the tester node to verify that the register value has changed.
        4. Compare the values the register node received and the value that Yukon reports that it changed the register
         to.
        Note:
        Testing is done on port 5001 and the actual application uses port 5000
        """
        try:
            await create_yukon(124)
            with pycyphal.application.make_node(
                    make_test_node_info("test_subject"),
                    get_registry_with_transport_set_up(126)
            ) as node, pycyphal.application.make_node(
                make_test_node_info("tester"),
                get_registry_with_transport_set_up(127),
            ) as tester_node:
                # Published heartbeat fields can be configured as follows.
                node.heartbeat_publisher.mode = uavcan.node.Mode_1.OPERATIONAL  # type: ignore
                node.heartbeat_publisher.vendor_specific_status_code = os.getpid() % 100
                node.registry.setdefault("analog.rcpwm.deadband", ValueProxy(Real32(0.00004699999873689376)))
                tester_node.heartbeat_publisher.mode = uavcan.node.Mode_1.OPERATIONAL  # type: ignore
                tester_node.heartbeat_publisher.vendor_specific_status_code = (os.getpid() - 1) % 100
                node.start()
                tester_node.start()

                session = aiohttp.ClientSession()
                http_update_response = await session.post("http://localhost:5001/api/update_register_value",
                                                          json={
                                                              "arguments": [
                                                                  "analog.rcpwm.deadband",
                                                                  {
                                                                      "real32": {"value": [0.00004599999873689376]},
                                                                      "_meta_": {"mutable": True, "persistent": True},
                                                                  },
                                                                  126,
                                                              ]
                                                          }, timeout=3)
                service_client = tester_node.make_client(uavcan.register.Access_1_0, node.id)
                msg = uavcan.register.Access_1_0.Request()
                msg.name.name = "analog.rcpwm.deadband"
                verification_response = await service_client.call(msg)
                obj = verification_response[0]
                verification_exploded_value = explode_value(
                    obj.value, metadata={"mutable": obj.mutable, "persistent": obj.persistent}
                )
                verification_exploded_value_str = json.dumps(verification_exploded_value,
                                                             cls=EnhancedJSONEncoder)
                verification_simplified_value = str(explode_value(obj.value, simplify=True))
                if verification_response is not None:
                    logger.debug("Response: %s", verification_response)
                if http_update_response.status != 200:
                    return False
                try:
                    response_update = json.loads(await http_update_response.text())
                except json.decoder.JSONDecodeError:
                    return False
                logger.debug("response_update: %s", response_update)

                if response_update.get("success") is not True:
                    return False
                return verification_exploded_value_str == response_update.get("value")
        except (requests.exceptions.ConnectionError, requests.exceptions.ReadTimeout):
            logger.exception("Connection error")
            raise Exception(
                "Update registers command to Yukon FAILED,"
                f" API was not available. Connection error.\n {traceback.format_exc(chain=False)}"
            ) from None
        finally:
            if session:
                await session.close()
