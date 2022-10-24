import asyncio
import json
import logging
import os
import traceback
import math
import typing

import psutil
import pycyphal
import pycyphal.application
import requests
from pycyphal.application.register import ValueProxy, Real32
from requests.adapters import HTTPAdapter
import aiohttp

import uavcan
from yukon.services.value_utils import explode_value
from .create_yukon import create_yukon

logger = logging.getLogger(__name__)

OneTryHttpAdapter = HTTPAdapter(max_retries=1)


def get_registry_with_transport_set_up(node_id: int) -> pycyphal.application.register.Registry:
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


def kill(proc_pid):
    process = psutil.Process(proc_pid)
    for proc in process.children(recursive=True):
        proc.kill()
    process.kill()


class TestBackendTestSession:
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
        session = None
        yukon_process = None
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
                yukon_process = await create_yukon(124)
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
                    0.1,
                    abs_tol=0.0001,
                )
                correct_avatar = None
                del avatars
                await session.get(
                    "http://localhost:5001/api/reread_registers",
                    json={"arguments": [{node.id: {"analog.rcpwm.deadband": True}}]},
                    timeout=3,
                )
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
                    0.2,
                    abs_tol=0.0001,
                )
                del correct_avatar
                del avatars
        finally:
            if session:
                await session.close()
            if yukon_process:
                kill(yukon_process.pid)
                await asyncio.sleep(1)

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
        session = None
        yukon_process = None
        try:
            yukon_process = await create_yukon(124)
            with pycyphal.application.make_node(
                make_test_node_info("test_subject"), get_registry_with_transport_set_up(126)
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
                http_update_response = await session.post(
                    "http://localhost:5001/api/update_register_value",
                    json={
                        "arguments": [
                            "analog.rcpwm.deadband",
                            {
                                "real32": {"value": [0.00004599999873689376]},
                                "_meta_": {"mutable": True, "persistent": True},
                            },
                            126,
                        ]
                    },
                    timeout=3,
                )
                service_client = tester_node.make_client(uavcan.register.Access_1_0, node.id)
                msg = uavcan.register.Access_1_0.Request()
                msg.name.name = "analog.rcpwm.deadband"
                verification_response = await service_client.call(msg)
                obj = verification_response[0]
                # verification_exploded_value = explode_value(
                #     obj.value, metadata={"mutable": obj.mutable, "persistent": obj.persistent}
                # )
                # verification_exploded_value_str = json.dumps(verification_exploded_value, cls=EnhancedJSONEncoder)
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
                assert verification_simplified_value == response_update.get("value")
        except (requests.exceptions.ConnectionError, requests.exceptions.ReadTimeout):
            logger.exception("Connection error")
            raise Exception(
                "Update registers command to Yukon FAILED,"
                f" API was not available. Connection error.\n {traceback.format_exc(chain=False)}"
            ) from None
        finally:
            if session:
                await session.close()
            if yukon_process:
                kill(yukon_process.pid)
                await asyncio.sleep(1)

    async def test_simplify_configuration(self):
        """Initialize Yukon.
        1. Make a request to localhost:5001/api/simplify_configuration, this will make Yukon simplify the configuration.
        2. Check if the value is as expected.
        Note:
        Testing is done on port 5001 and the actual application uses port 5000
        """
        session = None
        yukon_process = None
        try:
            yukon_process = await create_yukon(128)
            session = aiohttp.ClientSession()
            http_simplify_response = await session.post(
                "http://localhost:5001/api/simplify_configuration",
                json={"arguments": [{"analog.rcpwm.deadband": {"real32": {"value": [0.000046]}}}]},
                timeout=3,
            )
            if http_simplify_response.status != 200:
                return False
            try:
                response_simplify = json.loads(await http_simplify_response.text())
            except json.decoder.JSONDecodeError:
                return False
            logger.debug("response_simplify: %s", response_simplify)
            assert math.isclose(response_simplify.get("analog.rcpwm.deadband"), 0.000046, abs_tol=0.0001)
        except (requests.exceptions.ConnectionError, requests.exceptions.ReadTimeout):
            logger.exception("Connection error")
            raise Exception(
                "Simplify configuration command to Yukon FAILED,"
                f" API was not available. Connection error.\n {traceback.format_exc(chain=False)}"
            ) from None
        finally:
            if session:
                await session.close()
            if yukon_process:
                kill(yukon_process.pid)
                await asyncio.sleep(1)

    async def test_unsimplify_configuration(self):
        """Initialize Yukon.
        1. Set the value of analog.rcpwm.deadband in Yukon to 0.1.
        2. Make a request to localhost:5001/api/unsimplify_configuration,
        this will make Yukon unsimplify the configuration.
        3. Check if the value is as expected.
        Note:
        Testing is done on port 5001 and the actual application uses port 5000
        """
        session = None
        yukon_process = None
        try:
            yukon_process = await create_yukon(129)
            with pycyphal.application.make_node(
                make_test_node_info("test_subject"), get_registry_with_transport_set_up(126)
            ) as node:
                node.registry.setdefault("analog.rcpwm.deadband", ValueProxy(Real32(0.1)))
                session = aiohttp.ClientSession()
                await asyncio.sleep(3)
                http_unsimplify_response = await session.post(
                    "http://localhost:5001/api/unsimplify_configuration",
                    json={"arguments": [{"126": {"analog.rcpwm.deadband": [0.1]}}]},
                    timeout=3,
                )
                if http_unsimplify_response.status != 200:
                    return False
                try:
                    response_unsimplify = json.loads(await http_unsimplify_response.text())
                except json.decoder.JSONDecodeError:
                    return False
                logger.debug("response_unsimplify: %s", response_unsimplify)
                node_id_exists = response_unsimplify.get("126")
                register_exists = response_unsimplify.get("126").get("analog.rcpwm.deadband")
                datatype_exists = response_unsimplify.get("126").get("analog.rcpwm.deadband").get("real32")
                datatype_has_value = (
                    response_unsimplify.get("126").get("analog.rcpwm.deadband").get("real32").get("value")
                )
                datatype_value_is_correct = math.isclose(
                    response_unsimplify.get("126").get("analog.rcpwm.deadband").get("real32").get("value")[0],
                    0.1,
                    abs_tol=0.0001,
                )
                assert (
                    node_id_exists
                    and register_exists
                    and datatype_exists
                    and datatype_exists
                    and datatype_has_value
                    and datatype_value_is_correct
                )
        except (requests.exceptions.ConnectionError, requests.exceptions.ReadTimeout):
            logger.exception("Connection error")
            raise Exception(
                "Unsimplify configuration command to Yukon FAILED,"
                f" API was not available. Connection error.\n {traceback.format_exc(chain=False)}"
            ) from None
        finally:
            if session:
                await session.close()
            if yukon_process:
                kill(yukon_process.pid)
                await asyncio.sleep(1)

    async def test_attach_detach(self):
        """Initialize Yukon.
        1. Make a request to localhost:5001/api/attach, this will make Yukon attach to the node.
        2. Check if the value is as expected.
        3. Make a request to localhost:5001/api/detach, this will make Yukon detach from the node.
        4. Check if the value is as expected.
        Note:
        Testing is done on port 5001 and the actual application uses port 5000
        """
        session = None
        yukon_process = None
        try:
            yukon_process = await create_yukon(130)
            session = aiohttp.ClientSession()
            http_get_interfaces_response = await session.get(
                "http://localhost:5001/api/get_connected_transport_interfaces"
            )
            interfaces_response_object: typing.List[typing.Dict[typing.Union[str, int]]] = json.loads(
                await http_get_interfaces_response.text()
            ).get("interfaces")
            main_interface_found = False
            for interface in interfaces_response_object:
                if interface.get("udp_iface") == "127.0.0.0":
                    interface_hash = interface.get("hash")
                    main_interface_found = True
                    break
            assert main_interface_found
            http_detach_response = await session.post(
                "http://localhost:5001/api/detach_transport", json={"arguments": [interface_hash]}
            )
            if http_detach_response.status != 200:
                assert False
            try:
                response_detach = json.loads(await http_detach_response.text())
            except json.decoder.JSONDecodeError:
                assert False
            logger.debug("response_detach: %s", response_detach)
            assert response_detach.get("is_success") is True
        except (requests.exceptions.ConnectionError, requests.exceptions.ReadTimeout):
            logger.exception("Connection error")
            raise Exception(
                "Attach/detach command to Yukon FAILED,"
                f" API was not available. Connection error.\n {traceback.format_exc(chain=False)}"
            ) from None
        finally:
            if session:
                await session.close()
            if yukon_process:
                kill(yukon_process.pid)
                await asyncio.sleep(1)
