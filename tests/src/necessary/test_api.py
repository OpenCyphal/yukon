import logging
from multiprocessing.managers import ValueProxy
import os
import pycyphal
import sys
from pathlib import Path
import subprocess
import typing
from pycyphal.application.register import ValueProxy, Natural16, Natural32
import uavcan

logger = logging.getLogger(__name__)


async def test_get_socketcan_ports():
    """Send an api request to localhost:5000/api/get_socketcan_ports and check the response"""
    import requests
    import json

    response = requests.post("http://localhost:5000/api/get_socketcan_ports")
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


def setup_udp_capability() -> None:
    if sys.platform.startswith("linux"):
        # Enable packet capture for the Python executable. This is necessary for testing the UDP capture capability.
        # It can't be done from within the test suite because it has to be done before the interpreter is started.
        subprocess.run(["sudo", "setcap", "cap_net_raw+eip", str(Path("which", "python").resolve())])


def registry_with_transport_set_up() -> typing.Dict[str, typing.Any]:
    registry = pycyphal.application.make_registry(
        ":memory:",
        environment_variables={
            "uavcan.udp.iface": ValueProxy("127.0.0.0"),
            "uavcan.node.id": ValueProxy(Natural16([257])),
        },
    )


async def test_update_register_value(example_node):
    """
    Start a demo node first.
    Send an api request to localhost:5000/api/update_register_value and check the response.

    Uses the example_node fixture.
    """
    import requests
    import json

    class DemoNode:
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
            self._node = pycyphal.application.make_node(node_info, registry)

            # Published heartbeat fields can be configured as follows.
            self._node.heartbeat_publisher.mode = uavcan.node.Mode_1.OPERATIONAL  # type: ignore
            self._node.heartbeat_publisher.vendor_specific_status_code = os.getpid() % 100

    response = requests.post(
        "http://localhost:5000/api/update_register_value",
        json={
            "arguments": [
                "analog.rcpwm.deadband",
                {"real32": {"value": [0.00004599999873689376]}, "_meta_": {"mutable": True, "persistent": True}},
                125,
            ]
        },
    )

    # Make a new client to send an access request to the demo node
    service_client = testing_node.make_client(uavcan.register.Access_1_0, demo.node.id)
    testing_node = pycyphal.application.make_node(uavcan.node.GetInfo_1.Response(name="testing_node"), ":memory:")
    msg = uavcan.register.Access_1_0.Request()
    msg.name.name = None
    response = await service_client.call(msg)
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


# Unit tests here
async def verify_demo_node_has_register():
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
