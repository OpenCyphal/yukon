import logging
import os
import pycyphal

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


async def test_update_register_value(example_node):
    """Send an api request to localhost:5000/api/update_register_value and check the response.

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

    demo_node = DemoNode()
    testing_node = pycyphal.application.make_node(uavcan.node.GetInfo_1.Response(name="testing_node"), ":memory:")

    demo_node.run()
