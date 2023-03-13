import asyncio
import sys
from datetime import datetime
import json
import re
import typing
from pathlib import Path
from queue import Empty
from time import sleep, monotonic
import logging
import threading
import traceback

import yaml
from uuid import uuid4
from time import time

from yukon.domain.publisher import YukonPublisher
from yukon.custom_tk_dialog import launch_yes_no_dialog
from yukon.domain.simple_publisher import SimplePublisher
from yukon.services.snoop_registers import get_register_names
from yukon.services.messages_publisher import get_level_no

from yukon.services.utils import get_all_datatypes, get_all_field_dtos, get_datatype_return_dto, quit_application

try:
    from yaml import CLoader as Loader
except ImportError:
    from yaml import Loader  # type: ignore
import websockets
from flask import jsonify, Response

from pycyphal.presentation.subscription_synchronizer import get_local_reception_timestamp
from pycyphal.presentation.subscription_synchronizer.monotonic_clustering import MonotonicClusteringSynchronizer

import pycyphal.dsdl

import dronecan

from yukon.domain.subscriptions.synchronized_message_carrier import SynchronizedMessageCarrier
from yukon.domain.subscriptions.synchronized_message_store import SynchronizedMessageStore
from yukon.domain.subscriptions.synchronized_message_group import SynchronizedMessageGroup
from yukon.domain.subscriptions.synchronized_subjects_specifier import SynchronizedSubjectsSpecifier


from yukon.domain.transport.detach_transport_request import DetachTransportRequest
from yukon.domain.reactive_value_objects import ReactiveValue
from yukon.services.dtype_loader import load_dtype
from yukon.services.settings_handler import (
    recursive_reactivize_settings,
    save_settings,
    loading_settings_into_yukon,
)
from yukon.domain.subscriptions.unsubscribe_request import UnsubscribeRequest
from yukon.services.utils import clamp, tolerance_from_key_delta
from yukon.domain.subscriptions.subject_specifier_dto import SubjectSpecifierDto
from yukon.domain.subject_specifier import SubjectSpecifier
from yukon.domain.subscriptions.subscribe_request import SubscribeRequest
from yukon.domain.registers.reread_registers_request import RereadRegistersRequest
from yukon.domain.registers.update_register_log_item import UpdateRegisterLogItem
from yukon.domain.registers.apply_configuration_request import ApplyConfigurationRequest
from yukon.services.get_ports import get_socketcan_ports, get_slcan_ports
from yukon.services._dumper import Dumper
from yukon.domain.transport.attach_transport_request import AttachTransportRequest
from yukon.domain.interface import Interface
from yukon.domain.registers.update_register_request import UpdateRegisterRequest
from yukon.domain.avatar import Avatar
from yukon.services.value_utils import unexplode_value, explode_value
from yukon.domain.god_state import GodState
from yukon.services.messages_publisher import add_local_message
from yukon.domain.command_send_request import CommandSendRequest
from yukon.domain.registers.reread_register_names_request import RereadRegisterNamesRequest
from yukon.services.enhanced_json_encoder import EnhancedJSONEncoder

logger = logging.getLogger(__name__)


def make_sure_is_deserialized(any_conf: typing.Any) -> typing.Any:
    if isinstance(any_conf, str):
        # if the first character in deserialize_conf is a {, then it is a JSON string.
        if any_conf[0] == "{":
            return json.loads(any_conf)
        else:
            return yaml.load(any_conf, Loader=Loader)
    else:
        return any_conf


def is_network_configuration(deserialized_conf: typing.Any) -> bool:
    deserialized_conf = make_sure_is_deserialized(deserialized_conf)
    first_key = list(deserialized_conf.keys())[0]
    first_value = deserialized_conf[first_key]
    try:
        first_key = int(first_key)
    except ValueError:
        return False
    else:
        return True


def is_configuration_simplified(deserialized_conf: typing.Any) -> bool:
    """
    This should determine whether datatypes are shipped with the values.

    Exploded means that the datatype was removed.
    """
    deserialized_conf = make_sure_is_deserialized(deserialized_conf)
    first_key = list(deserialized_conf.keys())[0]
    first_value = deserialized_conf[first_key]
    if is_network_configuration(deserialized_conf):
        # This is the so-called network configuration file with multiple node_ids.
        first_actual_value = first_value[list(first_value.keys())[0]]
        if isinstance(first_actual_value, dict):
            return False
        else:
            return True
    else:
        # This configuration file only contains keys and values for one node_id
        if isinstance(first_value, dict):
            return False
        else:
            return True


def unexplode_a_register(state: GodState, node_id: int, register_name: str, register_value: str) -> str:
    """This desimplifies and adds back the datatypes that went missing in the simplification process."""
    assert isinstance(node_id, int)
    assert isinstance(register_value, str)
    avatar = state.avatar.avatars_by_node_id[node_id]
    prototype = unexplode_value(avatar.registers_exploded_values[register_name])
    value = unexplode_value(register_value, prototype)
    # This is to get it back into the primitive shape and then serialize as JSON.
    return json.dumps(explode_value(value))


def unsimplify_configuration(avatars_by_node_id: typing.Dict[int, Avatar], deserialized_conf: typing.Any) -> str:
    if is_configuration_simplified(deserialized_conf):
        if is_network_configuration(deserialized_conf):
            # This is the so-called network configuration file with multiple node_ids.
            for node_id, avatar in avatars_by_node_id.items():
                deserialized_node_specific_conf = deserialized_conf.get(str(node_id)) or deserialized_conf.get(
                    int(node_id)
                )
                if not deserialized_node_specific_conf:
                    continue
                for register_name, simplified_value in deserialized_node_specific_conf.items():
                    logger.debug("Unsimplifying %s", register_name)
                    simplified_value2 = json.loads(json.dumps(simplified_value))
                    logger.debug("The simplified value is %r", simplified_value2)
                    prototype = unexplode_value(avatar.registers_exploded_values[register_name])
                    logger.debug("prototype: %r", prototype)
                    if simplified_value2 == "NaN":
                        simplified_value2 = float("nan")
                    # normal
                    typed_value = explode_value(unexplode_value(simplified_value2, prototype))
                    deserialized_node_specific_conf[register_name] = typed_value
            return json.dumps(deserialized_conf)
        else:
            # In the future the API should end a request to the client to ask the user to select a node_id.
            return "{}"
    else:
        return json.dumps(deserialized_conf)


def simplify_configuration(any_conf: typing.Any) -> str:
    if not is_configuration_simplified(any_conf):
        if is_network_configuration(any_conf):
            # This is the so-called network configuration file with multiple node_ids.
            for node_id, values in any_conf.items():
                for register_name, typed_value_dict in any_conf[node_id].items():
                    simplified_value = explode_value(unexplode_value(typed_value_dict), simplify=True)
                    any_conf[node_id][register_name] = simplified_value
            return json.dumps(any_conf)
        else:
            for register_name, typed_value_dict in any_conf.items():
                simplified_value = explode_value(unexplode_value(typed_value_dict), simplify=True)
                any_conf[register_name] = simplified_value
            return json.dumps(any_conf)
    else:
        return json.dumps(any_conf)


def import_candump_file_contents() -> str:
    import tkinter as tk
    from tkinter.filedialog import askopenfilename, Open

    root = tk.Tk()
    root.geometry("1x1+0+0")
    root.eval("tk::PlaceWindow . center")
    root.lift()
    root.focus_force()
    open_dialog = Open(filetypes=[("Yaml files", ".yml .yaml")])
    file_path = open_dialog.show()
    root.lift()
    root.focus_force()
    root.withdraw()
    root.destroy()
    try:
        with open(file_path, "r") as f:
            contents = f.read()
            contents_deserialized = yaml.load(contents, Loader)
            contents_deserialized["__file_name"] = Path(file_path).name
            configuration = json.dumps(contents_deserialized)
    except Exception:
        logger.exception("Nothing was selected from the file dialog")
        return ""
    else:
        logger.debug(f"Configuration: {configuration}")
    return configuration


def make_yaml_string_node_ids_numbers(serialized_conf: str) -> str:
    # Using regex, replace "(\d)": with "\1": to make the node_ids numbers.
    # This is to make the YAML file more readable.
    return re.sub(r"['\"](\d+)['\"]", r"\1", serialized_conf)


def add_register_update_log_item(
    state: GodState, register_name: str, register_value: str, node_id: str, success: bool
) -> None:
    """This is useful to report failed user interactions which resulted in invalid requests to update registers."""
    try:
        request_sent_time = datetime.fromtimestamp(time()).strftime("%H:%M:%S.%f")
        target_avatar = state.avatar.avatars_by_node_id.get(int(node_id))
        if target_avatar:
            value_before_update = target_avatar.registers_values.get(register_name)
            if not value_before_update:
                value_before_update = ""
        else:
            value_before_update = ""
        state.cyphal.register_update_log.append(
            UpdateRegisterLogItem(None, register_name, request_sent_time, None, value_before_update, success)
        )
    except Exception as e:
        logger.exception("Failed to add register update log item")
        tb = traceback.format_exc()
        logger.error(f"Traceback: {str(tb)}")


class SendingApi:
    async def send_message(self, message: typing.Any) -> None:
        async with await websockets.connect("ws://localhost:8765/hello") as websocket:
            await websocket.send("Hello world!")
            await websocket.recv()


class Api:
    last_avatars: typing.List[Avatar] = []

    def __init__(self, state: GodState):
        self.state = state
        assert self.state is state
        self.last_avatars = []

    def get_socketcan_ports(self) -> Response:
        socket_can_ports = get_socketcan_ports()
        _list = [{"name": port_name, "already_used": False} for port_name in socket_can_ports]
        for port in _list:
            if self.state.cyphal.already_used_transport_interfaces.get("socketcan:" + port["name"]):
                port["already_used"] = True
        _list_hash = json.dumps(_list, sort_keys=True)
        return jsonify(
            {
                "ports": _list,
                "hash": _list_hash,
            }
        )

    def get_slcan_ports(self) -> typing.Dict[str, typing.Any]:
        _list = get_slcan_ports()
        for port in _list:
            if self.state.cyphal.already_used_transport_interfaces.get("slcan:" + port.get("device")):
                port["already_used"] = True
        _list_hash = json.dumps(_list, sort_keys=True)
        return {
            "ports": _list,
            "hash": _list_hash,
        }

    def add_local_message(self, message: str, severity: int) -> None:
        if severity is None or (int(severity) >= get_level_no(self.state.gui.message_severity)):
            add_local_message(self.state, message, severity, "Frontend")

    def import_all_of_register_configuration(self) -> str:
        return import_candump_file_contents()

    def import_node_configuration(self) -> str:
        return import_candump_file_contents()

    def is_configuration_simplified(self, deserialized_configuration: typing.Any) -> Response:
        return jsonify(is_configuration_simplified(deserialized_configuration))

    def is_network_configuration(self, deserialized_configuration: typing.Any) -> Response:
        value = is_network_configuration(deserialized_configuration)
        return jsonify(value)

    def apply_configuration_to_node(self, node_id: int, configuration: str) -> None:
        request = ApplyConfigurationRequest(node_id, configuration, is_network_configuration(configuration))
        self.state.queues.god_queue.put_nowait(request)

    def apply_all_of_configuration(self, configuration: str) -> None:
        request = ApplyConfigurationRequest(None, configuration, is_network_configuration(configuration))
        self.state.queues.god_queue.put_nowait(request)

    def simplify_configuration(self, configuration: str) -> Response:
        if isinstance(configuration, str):
            # if the first character in deserialize_conf is a {, then it is a JSON string.
            if configuration[0] == "{":
                deserialized_conf = json.loads(configuration)
            else:
                deserialized_conf = yaml.load(configuration, Loader=Loader)
        else:
            deserialized_conf = configuration
        # I refused to change the API of simplify_configuration, so I have to reparse it in jsonify
        # jsonify uses the correct JSON dumper
        return jsonify(json.loads(simplify_configuration(deserialized_conf)))

    def unsimplify_configuration(self, configuration: str) -> Response:
        if isinstance(configuration, str):
            # if the first character in deserialize_conf is a {, then it is a JSON string.
            if configuration[0] == "{":
                deserialized_conf = json.loads(configuration)
            else:
                deserialized_conf = yaml.load(configuration, Loader=Loader)
        else:
            deserialized_conf = configuration
        return jsonify(json.loads(unsimplify_configuration(self.state.avatar.avatars_by_node_id, deserialized_conf)))

    def open_file_dialog(self) -> typing.Any:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()

        file_path = filedialog.askopenfilename()
        file_dto = {}
        # Get the file contents
        with open(file_path, "r") as f:
            file_dto["contents"] = f.read()
            file_dto["name"] = Path(file_path).name
        return file_dto

    def update_register_value(self, register_name: str, register_value: typing.Any, node_id: str) -> typing.Any:
        try:
            import uavcan

            new_value: uavcan.register.Value_1 = unexplode_value(register_value)
            request = UpdateRegisterRequest(uuid4(), register_name, new_value, int(node_id), time())
            self.state.queues.god_queue.put_nowait(request)
            timeout = time() + 5

            while time() < timeout:
                # This is a get from a dictionary, not a queue, so it is not blocking
                response = self.state.queues.update_registers_response.get(request.request_id)
                if not response:
                    sleep(0.1)
                else:
                    if response.success:
                        logger.info(f"Successfully updated register {register_name} to {register_value}")
                    else:
                        logger.error(f"Failed to update register {register_name} to {register_value}")
                    return jsonify(response)
            logger.critical("Something is wrong with updating registers.")
            raise Exception(f"Failed to update register {register_name} to {register_value}, critical timeout")
        except Exception as e:
            tb = traceback.format_exc()
            logger.error(f"Failed to update register value.")
            logger.error(tb)
            return jsonify({"success": False, "message": str(e)})

    def get_register_update_log_items(self) -> Response:
        return jsonify(self.state.cyphal.register_update_log)

    def attach_udp_transport(self, udp_iface: str, udp_mtu: int, node_id: int) -> typing.Any:
        try:
            logger.info(f"Attaching UDP transport to {udp_iface}")
            interface = Interface()
            interface.node_id = int(node_id)
            interface.is_udp = True
            interface.udp_iface = udp_iface
            interface.udp_mtu = int(udp_mtu)
            interface.is_udp = True
            # Once one of these requests has been made, look for the continuation of code flow in
            # the cyphal_worker.py folder in services.
            atr: AttachTransportRequest = AttachTransportRequest(interface, int(node_id))
            self.state.queues.god_queue.put_nowait(atr)
            try:
                response = self.state.queues.attach_transport_response.get(timeout=5)
            except Empty:
                raise Exception("Failed to receive a response for attached CAN transport.")
            return jsonify(response)
        except Exception as e:
            tb = traceback.format_exc()
            logger.error(f"Failed to attach UDP transport: {e}\n{tb}")
            return jsonify({"is_success": False, "message": "Failed to attach UDP transport."})

    def attach_transport(
        self, interface_string: str, arb_rate: str, data_rate: str, node_id: str, mtu: str
    ) -> typing.Any:
        try:
            logger.info(f"Attach transport request: {interface_string}, {arb_rate}, {data_rate}, {node_id}, {mtu}")
            interface = Interface()
            interface.node_id = node_id
            interface.rate_arb = int(arb_rate)
            interface.rate_data = int(data_rate)
            interface.mtu = int(mtu)
            interface.iface = interface_string

            atr: AttachTransportRequest = AttachTransportRequest(interface, int(node_id))
            self.state.queues.god_queue.put_nowait(atr)
            try:
                response = self.state.queues.attach_transport_response.get(timeout=7)
            except Empty:
                raise Exception("Failed to receive a response for attached CAN transport.")
            return jsonify(response)
        except Exception as e:
            tb = traceback.format_exc()
            logger.error(f"Failed to attach transport: {e}\n{tb}")
            logger.error(str(tb))
            return jsonify({"is_success": False, "message": str(e)})

    def detach_transport(self, hash: str) -> typing.Any:
        logger.info(f"Detaching transport {hash}")
        self.state.queues.god_queue.put_nowait(DetachTransportRequest(hash))
        try:
            response = self.state.queues.detach_transport_response.get(timeout=5)
        except Empty:
            raise Exception("Failed to receive a response for detached CAN transport.")
        return jsonify(response)

    # def save_registers_of_node(self, node_id: int, registers: typing.Dict["str"]) -> None:
    def show_yakut(self) -> None:
        self.state.avatar.hide_yakut_avatar = False

    def reread_registers(self, request_contents: typing.Dict[int, typing.Dict[str, bool]]) -> None:
        """yukon/web/modules/registers.data.module.js explains the request_contents structure."""
        request = RereadRegistersRequest(uuid4(), request_contents)
        self.state.queues.god_queue.put_nowait(request)

    def hide_yakut(self) -> None:
        self.state.avatar.hide_yakut_avatar = True

    def get_messages(self, since_index: int = 0) -> Response:
        my_list = [x for x in list(self.state.queues.messages.queue) if not since_index or x.index_nr >= since_index]
        return jsonify(my_list)

    def get_avatars(self) -> typing.Any:
        self.state.gui.last_poll_received = monotonic()
        avatar_list = [avatar.to_builtin() for avatar in list(self.state.avatar.avatars_by_node_id.values())]
        avatar_dto = {"avatars": avatar_list, "hash": hash(json.dumps(avatar_list, sort_keys=True))}
        return jsonify(avatar_dto)

    def remove_avatar(self, node_id: int) -> Response:
        if self.state.avatar.avatars_by_node_id.get(int(node_id)):
            del self.state.avatar.avatars_by_node_id[int(node_id)]
            return jsonify({"success": True})
        else:
            return jsonify({"success": False})

    def get_log_level(self) -> Response:
        return jsonify({"severity": self.state.gui.message_severity})

    def set_log_level(self, severity: str) -> None:
        self.state.gui.message_severity = severity

    def get_connected_transport_interfaces(self) -> Response:
        return jsonify(
            {
                "interfaces": self.state.cyphal.transports_list,
                "hash": hash(json.dumps(self.state.cyphal.transports_list, sort_keys=True, cls=EnhancedJSONEncoder)),
            }
        )

    def send_command(self, node_id: str, command: str, text_argument: str) -> typing.Any:
        send_command_request = CommandSendRequest(int(node_id), int(command), text_argument)
        if int(command) == 65533:
            if not launch_yes_no_dialog(
                f"Are you sure you want to update node {node_id} firmware to {text_argument}?",
                "Confirm firmware update",
                20000,
            ):
                return jsonify({"success": False, "message": "User cancelled."})
        self.state.queues.god_queue.put_nowait(send_command_request)
        try:
            response = self.state.queues.command_response.get(timeout=5)
        except Empty:
            raise Exception("Failed to receive a response for sending command.")
        return jsonify({"success": response.is_success, "message": response.message})

    def reread_node(self, node_id: str) -> Response:
        async def get_register_names_helper() -> None:
            await get_register_names(
                self.state,
                node_id,
                self.state.avatar.avatars_by_node_id[node_id],
                True,
            )

        try:
            self.state.cyphal_worker_asyncio_loop.create_task(get_register_names_helper())
        except Exception as e:
            tb = traceback.format_exc()
            logger.error(tb)
            return jsonify({"success": False, "message": str(e)})

    def announce_running_in_electron(self) -> None:
        logger.info("Announcing running in electron.")
        self.state.gui.is_running_in_browser = False
        self.state.gui.is_target_client_known = True

    def announce_running_in_browser(self) -> None:
        self.state.gui.is_running_in_browser = True
        self.state.gui.is_target_client_known = True

    def close_yukon(self) -> None:
        try:
            import pyi_splash

            pyi_splash.close()
        except ImportError:
            pass
        quit_application(self.state)

    def yaml_to_yaml(self, yaml_in: str) -> Response:
        text_response = Dumper().dumps(yaml.load(yaml_in, Loader))
        return Response(response=text_response, content_type="text/yaml", mimetype="text/yaml")

    def json_to_yaml(self, json_in: str) -> Response:
        text_response = Dumper().dumps(json.loads(json_in))
        return Response(response=text_response, content_type="text/yaml", mimetype="text/yaml")

    def add_register_update_log_item(self, register_name: str, register_value: str, node_id: str, success: str) -> None:
        """This is useful to report failed user interactions which resulted in invalid requests to update registers."""
        add_register_update_log_item(self.state, register_name, register_value, node_id, bool(success))

    def subscribe(self, subject_id: typing.Optional[typing.Union[int, str]], datatype: str) -> Response:
        try:
            if subject_id:
                subject_id = int(subject_id)
            self.state.queues.god_queue.put_nowait(SubscribeRequest(SubjectSpecifier(subject_id, datatype)))
        except Exception as e:
            logger.error("Failed to register subscribe intent.", exc_info=True)
            logger.error(str(e))
            return jsonify({"success": False, "message": "Failed to register subscribe intent."})
        try:
            response = self.state.queues.subscribe_requests_responses.get(timeout=5)
        except Empty:
            raise Exception("Failed to receive a response for subscribing.")
        return jsonify(response)

    def enable_udp_output_from(self, specifier: str) -> None:
        """Get the message store for the specifier and enable UDP output for it."""
        messages_store = self.state.cyphal.message_stores_by_specifier.get(SubjectSpecifier.from_string(specifier))
        if messages_store:
            messages_store.enable_udp_output = True

    def disable_udp_output_from(self, specifier: str) -> None:
        """Get the message store for the specifier and enable UDP output for it."""
        messages_store = self.state.cyphal.message_stores_by_specifier.get(SubjectSpecifier.from_string(specifier))
        if messages_store:
            messages_store.enable_udp_output = False

    def unsubscribe(self, specifier: str) -> Response:
        try:
            self.state.queues.god_queue.put_nowait(UnsubscribeRequest(SubjectSpecifier.from_string(specifier)))
            try:
                response = self.state.queues.unsubscribe_requests_responses.get(timeout=5)
            except Empty:
                logger.error("Failed to receive a confirmation for unsubscribing.")
            else:
                return jsonify(
                    {
                        "success": response.success,
                        "message": "Unsubscribed from " + specifier,
                    }
                )
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Failed to register unsubscribe intent.")
            logger.error(str(tb))
            return jsonify({"success": False, "message": "Failed to register unsubscribe intent."})

    def fetch_messages_for_subscription_specifiers(self, specifiers: str) -> Response:
        """
        A specifier is a subject_id concatenated with a datatype, separated by a colon.

        The DTO, which specifiers is a JSON serialized list of,
        contains an additional counter also separated by a colon.
        """
        try:
            specifiers_object = json.loads(specifiers)
            dtos = [SubjectSpecifierDto.from_string(x) for x in specifiers_object]
            mapping = {}
            for specifier, messages_store in self.state.cyphal.message_stores_by_specifier.items():
                for dto in dtos:
                    if dto.does_equal_specifier(specifier):
                        mapping[str(dto)] = messages_store.messages[dto.counter - messages_store.start_index :]
                        break
            # This jsonify is why I made sure to set up the JSON encoder for dsdl
            return jsonify(mapping)
        except Exception as e:
            logger.error("Failed to fetch messages for subscription specifiers.", exc_info=True)
            logger.error(str(e))
            return jsonify({"success": False, "message": "Failed to fetch messages for subscription specifiers."})

    def make_simple_publisher(self) -> Response:
        try:
            new_publisher = SimplePublisher(str(uuid4()), self.state)
            self.state.cyphal.publishers_by_id[new_publisher.id] = new_publisher
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Failed to make simple publisher.")
            logger.error(str(tb))
            return jsonify({"success": False, "message": traceback.format_exc()})
        else:
            return jsonify({"success": True, "id": new_publisher.id})

    def make_simple_publisher_with_datatype_and_port_id(self, datatype: str, port_id: int) -> Response:
        try:
            new_publisher = SimplePublisher(str(uuid4()), self.state)
            new_publisher.datatype = datatype
            new_publisher.port_id = int(port_id)
            self.state.cyphal.publishers_by_id[new_publisher.id] = new_publisher
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Failed to make simple publisher.")
            logger.error(str(tb))
            return jsonify({"success": False, "message": traceback.format_exc()})
        else:
            return jsonify({"success": True, "id": new_publisher.id})

    def publish(self, publisher_id: str) -> Response:
        publisher = self.state.cyphal.publishers_by_id.get(publisher_id)
        if publisher is None:
            return jsonify({"success": False, "message": "Publisher %s not found." % publisher_id})
        try:
            # print(monotonic(), "API told to publish")
            self.state.cyphal_worker_asyncio_loop.call_soon_threadsafe(publisher.publish)
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Failed to publish.")
            logger.error(str(tb))
            return jsonify({"success": False, "message": traceback.format_exc()})

    def remove_publisher(self, id: str) -> Response:
        try:
            del self.state.cyphal.publishers_by_id[id]
            return jsonify({"success": True})
        except:
            return jsonify({"success": False, "message": traceback.format_exc()})

    def set_publisher_name(self, id: str, new_name: str) -> Response:
        try:
            publisher = self.state.cyphal.publishers_by_id.get(id)
            if publisher is None:
                return jsonify({"success": False, "message": "Publisher %s not found." % id})
            publisher.name = new_name
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"success": False, "message": str(e)})

    def set_publisher_enabled(self, id: str, enabled: bool) -> Response:
        try:
            publisher = self.state.cyphal.publishers_by_id.get(id)
            if publisher is None:
                return jsonify({"success": False, "message": "Publisher %s not found." % id})
            publisher.enabled = enabled
            return jsonify({"success": True})
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Failed to set publisher enabled.")
            logger.error(str(tb))
            return jsonify({"success": False, "message": str(e)})

    def get_potential_fixed_port_id_of_publisher(self, publisher_id: str) -> Response:
        try:
            publisher = self.state.cyphal.publishers_by_id.get(publisher_id)
            if publisher is None:
                return jsonify({"success": False, "message": "Publisher %s not found." % publisher_id})
            return jsonify({"success": True, "port_id": publisher.port_id})
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Failed to get potential fixed port id of publisher.")
            logger.error(str(tb))
            return jsonify({"success": False, "message": str(e)})

    def set_publisher_port_id(self, id: str, port_id: str) -> Response:
        try:
            publisher = self.state.cyphal.publishers_by_id.get(id)
            if publisher is None:
                return jsonify({"success": False, "message": "Publisher %s not found." % id})
            publisher.port_id = int(port_id)
            return jsonify({"success": True})
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Failed to set publisher port id.")
            logger.error(str(tb))
            return jsonify({"success": False, "message": str(e)})

    def make_publisher_field(self, publisher_id: str, field_id: str) -> Response:
        try:
            field = self.state.cyphal.publishers_by_id[publisher_id].add_field(field_id)
            return jsonify({"success": True, "field": field})
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Failed to make publisher field.")
            logger.error(str(tb))
            return jsonify({"success": False, "message": "Failed to make publisher field."})

    def get_publisher_possible_paths_for_autocomplete(self, publisher_id: str) -> Response:
        """Returns a list of possible paths for the publisher_id."""
        try:
            publisher: SimplePublisher = self.state.cyphal.publishers_by_id[publisher_id]
            result = get_all_field_dtos(load_dtype(publisher.datatype))
            return jsonify(result)
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Failed to get publisher possible paths for autocomplete.")
            logger.error(str(tb))
            return jsonify({"success": False, "message": "Failed to get publisher possible paths for autocomplete."})

    def delete_publisher_field(self, publisher_id: str, field_id: str) -> Response:
        try:
            self.state.cyphal.publishers_by_id[publisher_id].delete_field(field_id)
            return jsonify({"success": True})
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Failed to delete publisher field.")
            logger.error(str(tb))
            return jsonify({"success": False, "message": "Failed to delete publisher field."})

    def set_publisher_field_type_path(self, publisher_id: str, field_id: str, type_path: str) -> Response:
        try:
            self.state.cyphal.publishers_by_id[publisher_id].get_field(field_id).type_path = type_path
            return jsonify(
                {"success": True, "field": self.state.cyphal.publishers_by_id[publisher_id].get_field(field_id)}
            )
        except:
            return jsonify({"success": False, "message": traceback.format_exc()})

    def set_publisher_datatype(self, publisher_id: str, datatype: str) -> Response:
        try:
            self.state.cyphal.publishers_by_id[publisher_id].datatype = datatype
            return jsonify({"success": True, "publisher": self.state.cyphal.publishers_by_id[publisher_id]})
        except:
            return jsonify({"success": False, "message": traceback.format_exc()})

    def set_publisher_field_specifier(self, publisher_id: str, field_id: str, datatype: str) -> Response:
        try:
            self.state.cyphal.publishers_by_id[publisher_id].get_field(field_id).field_specifier = datatype
            return jsonify(
                {"success": True, "field": self.state.cyphal.publishers_by_id[publisher_id].get_field(field_id)}
            )
        except:
            return jsonify({"success": False, "message": traceback.format_exc()})

    def get_publisher_field(self, publisher_id: str, field_id: str) -> Response:
        return jsonify(self.state.cyphal.publishers_by_id[publisher_id].get_field(field_id))

    def get_publisher_fields(self, publisher_id: str) -> Response:
        try:
            fields = self.state.cyphal.publishers_by_id[publisher_id].fields
            return jsonify({"success": True, "fields": fields})
        except:
            return jsonify({"success": False, "message": traceback.format_exc(), "fields": []})

    def set_publisher_field_value(self, publisher_id: str, field_id: str, value: str) -> Response:
        try:
            self.state.cyphal.publishers_by_id[publisher_id].get_field(field_id).value = value
            return jsonify({"success": True})
        except:
            return jsonify({"success": False, "message": traceback.format_exc()})

    def get_publisher_field_value(self, publisher_id: str, field_id: str) -> Response:
        try:
            value = self.state.cyphal.publishers_by_id[publisher_id].get_field(field_id).value
            return jsonify({"success": True, "value": value})
        except:
            return jsonify({"success": False, "message": traceback.format_exc()})

    def set_field_min_max(self, publisher_id: str, field_id: str, min: float, max: float) -> Response:
        try:
            self.state.cyphal.publishers_by_id[publisher_id].get_field(field_id).min = min
            self.state.cyphal.publishers_by_id[publisher_id].get_field(field_id).max = max
            return jsonify({"success": True})
        except:
            return jsonify({"success": False, "message": traceback.format_exc()})

    def set_publisher_rate(self, publisher_id: str, rate: int) -> Response:
        try:
            self.state.cyphal.publishers_by_id[publisher_id].rate_per_second = rate
            return jsonify({"success": True})
        except:
            return jsonify({"success": False, "message": traceback.format_exc()})

    def update_publisher(self, publisher_id: str, specifier: str, data: str) -> Response:
        try:
            specifier_object = SubjectSpecifier.from_string(specifier)
            self.state.cyphal.publishers_by_id[publisher_id].update_value(specifier_object, data)
            return jsonify({"success": True})
        except:
            return jsonify({"success": False, "message": traceback.format_exc()})

    def get_publishers(self) -> Response:
        try:
            return jsonify(self.state.cyphal.publishers_by_id)
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Failed to get publishers.")
            logger.error(str(tb))
            return jsonify({"success": False, "message": "Failed to get publishers."})

    def get_number_type_min_max_values(self, type_name: str) -> Response:
        try:
            _match = re.match(r"uavcan\.primitive\.array\.([A-Za-z]+)([0-9]+)_([0-9]+)_([0-9]+)", type_name)
            if _match:
                bit_depth = int(_match.group(2))
                is_signed = _match.group(1) != "Natural"
                return jsonify(
                    {
                        "success": True,
                        "min": -(2 ** (bit_depth - 1)) if is_signed else 0,
                        "max": 2 ** (bit_depth - 1) - 1 if is_signed else 2**bit_depth - 1,
                    }
                )
            return {"success": False, "message": "Unknown type name"}
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Failed to get publishers.")
            logger.error(str(tb))
            return jsonify({"success": False, "message": "Failed to get publishers."})

    def get_publish_type_names(self) -> Response:
        return jsonify(
            [
                "uavcan.primitive.array.Real64_1_0",
                "uavcan.primitive.array.Real32_1_0",
                "uavcan.primitive.array.Real16_1_0",
                "uavcan.primitive.array.Integer64_1_0",
                "uavcan.primitive.array.Integer32_1_0",
                "uavcan.primitive.array.Integer16_1_0",
                "uavcan.primitive.array.Natural64_1_0",
                "uavcan.primitive.array.Natural32_1_0",
                "uavcan.primitive.array.Natural16_1_0",
                "uavcan.primitive.array.Natural8_1_0",
            ]
        )

    def set_message_store_capacity(self, specifier: str, capacity: int) -> None:
        messages_store = self.state.cyphal.message_stores_by_specifier.get(SubjectSpecifier.from_string(specifier))
        if messages_store:
            messages_store.capacity = int(capacity)

    def set_sync_store_capacity(self, specifiers: str, capacity: int) -> None:
        try:
            specifiers_object = json.loads(specifiers)
            synchronized_subjects_specifier = SynchronizedSubjectsSpecifier(specifiers_object)
            messages_store = self.state.cyphal.synchronized_message_stores[synchronized_subjects_specifier]
            if messages_store:
                messages_store.capacity = int(capacity)
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Failed to set sync store capacity.")
            logger.error(str(tb))

    def subscribe_synchronized(self, specifiers: str) -> Response:
        try:
            result_ready_event = threading.Event()
            was_subscription_success: bool = False
            message: str = ""
            tolerance = 0.1

            def subscribe_task() -> None:
                nonlocal was_subscription_success, message
                try:
                    specifiers_object = json.loads(specifiers)
                    synchronized_subjects_specifier = SynchronizedSubjectsSpecifier(specifiers_object)
                    if self.state.cyphal.synchronizers_by_specifier.get(synchronized_subjects_specifier):
                        raise Exception("Already subscribed to synchronized messages for this specifier.")
                    subscribers = []
                    for dto in synchronized_subjects_specifier.specifiers:
                        new_subscriber = self.state.cyphal.local_node.make_subscriber(
                            load_dtype(dto.datatype), dto.subject_id
                        )
                        subscribers.append(new_subscriber)
                    synchronizer = MonotonicClusteringSynchronizer(
                        subscribers, get_local_reception_timestamp, tolerance
                    )
                    self.state.cyphal.synchronizers_by_specifier[synchronized_subjects_specifier] = synchronizer
                    synchronized_message_store = SynchronizedMessageStore(specifiers)
                    self.state.cyphal.synchronized_message_stores[
                        synchronized_subjects_specifier
                    ] = synchronized_message_store
                    synchronized_message_store.specifiers = specifiers
                    counter = 0
                    prev_key: typing.Any = None

                    def message_receiver(*messages: typing.Tuple[typing.Any]) -> None:
                        nonlocal counter, prev_key
                        timestamp = None
                        # Missing a messages list and the timestamp
                        synchronized_message_group = SynchronizedMessageGroup()
                        try:
                            key = sum(get_local_reception_timestamp(x) for x in messages) / len(messages)
                            if prev_key is not None:
                                synchronizer.tolerance = clamp(
                                    (1e-6, 10.0),
                                    (synchronizer.tolerance + tolerance_from_key_delta(prev_key, key)) * 0.5,
                                )
                            prev_key = key
                        except:
                            tb = traceback.format_exc()
                            logger.error(tb)
                        for index, message in enumerate(messages):
                            synchronized_message_carrier = SynchronizedMessageCarrier(
                                pycyphal.dsdl.to_builtin(message[0]),
                                None,
                                counter,
                                synchronized_subjects_specifier.specifiers[index].subject_id,
                            )
                            counter += 1
                            synchronized_message_group.carriers.append(synchronized_message_carrier)
                        synchronized_message_store.messages.append(synchronized_message_group)
                        if synchronized_message_store.counter >= synchronized_message_store.capacity:
                            synchronized_message_store.messages.pop(0)
                            synchronized_message_store.start_index += 1

                    synchronizer.receive_in_background(message_receiver)
                    was_subscription_success = True
                    result_ready_event.set()

                except Exception as e:
                    print("Exception in subscribe_synchronized: " + str(e))
                    tb = traceback.format_exc()
                    logger.error(tb)
                    message = tb

                # synchronizer.receive_in_background

            self.state.cyphal_worker_asyncio_loop.call_soon_threadsafe(subscribe_task)
            if result_ready_event.wait(1.7):
                return jsonify(
                    {
                        "success": was_subscription_success,
                        "specifiers": specifiers,
                        "message": message,
                        "tolerance": tolerance,
                    }
                )
            else:
                return jsonify(
                    {
                        "success": False,
                        "specifiers": specifiers,
                        "message": "Timed out waiting for a response from the Cyphal worker thread.",
                        "tolerance": tolerance,
                    }
                )
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Failed to subscribe to synchronized messages.")
            logger.error(str(tb))
            return jsonify({"success": False, "message": tb})

    def unsubscribe_synchronized(self, specifiers: str) -> Response:
        try:
            specifiers_object = json.loads(specifiers)
            sync_specifier = SynchronizedSubjectsSpecifier(specifiers_object)
            synchronizer = self.state.cyphal.synchronizers_by_specifier.get(sync_specifier)
            synchronizer.close()
            del self.state.cyphal.synchronizers_by_specifier[sync_specifier]
            del self.state.cyphal.synchronized_message_stores[sync_specifier]
            return jsonify({"success": True, "specifiers": specifiers})
        except:
            logger.error("Failed to unsubscribe from synchronized messages.")
            tb = traceback.format_exc()
            logger.error(str(tb))
            return jsonify({"success": False, "specifiers": specifiers, "message": tb})

    def fetch_synchronized_messages_for_specifiers(self, specifiers: str, counter: int) -> Response:
        """Specifiers is a JSON serialized list of specifiers."""
        try:
            specifiers_object = json.loads(specifiers)
            specifier_objects = [SubjectSpecifier.from_string(x) for x in specifiers_object]
            """An array containing arrays of synchronized messages"""
            synchronized_messages_store = self.state.cyphal.synchronized_message_stores.get(
                SynchronizedSubjectsSpecifier(specifier_objects)
            )
            if not synchronized_messages_store:
                return jsonify({"success": False, "message": "No synchronized messages for this specifier."})
            if synchronized_messages_store.start_index >= counter:
                return jsonify(synchronized_messages_store.messages[0:])
            else:
                return jsonify(
                    synchronized_messages_store.messages[counter - synchronized_messages_store.start_index :]
                )
        except Exception as e:
            logger.error("Failed to fetch synchronized messages.")
            tb = traceback.format_exc()
            logger.error(str(tb))
            return jsonify({"success": False, "message": tb})

    def get_current_available_subscription_specifiers(self) -> Response:
        """A specifier is a subject_id concatenated with a datatype, separated by a colon."""
        try:
            specifiers = []
            for specifier, messages_store in self.state.cyphal.message_stores_by_specifier.items():
                specifiers.append(str(specifier))
            specifiers_return_value = {"hash": hash(tuple(specifiers)), "specifiers": specifiers}
            return jsonify(specifiers_return_value)
        except Exception as e:
            logger.error("Failed to get current available subscription specifiers.")
            tb = traceback.format_exc()
            logger.error(str(tb))
            return jsonify({"success": False, "message": tb})

    def get_current_available_synchronized_subscription_specifiers(self) -> Response:
        """A specifier is a subject_id concatenated with a datatype, separated by a colon."""
        try:
            specifiers = []
            for specifier, messages_store in self.state.cyphal.synchronized_message_stores.items():
                specifiers.append(str(specifier))
            specifiers_return_value = {"hash": hash(tuple(specifiers)), "specifiers": specifiers}
            return jsonify(specifiers_return_value)
        except Exception as e:
            logger.error("Failed to get current available synchronized subscription specifiers.")
            tb = traceback.format_exc()
            logger.error(str(tb))
            return jsonify({"success": False, "message": tb})

    def get_known_datatypes_from_dsdl_for_publishers(self) -> Response:
        start = monotonic()
        return_object = self.get_known_datatypes_from_dsdl()
        logger.info(f"get_known_datatypes_from_dsdl_for_publishers took {monotonic() - start} seconds.")
        return return_object

    def get_known_datatypes_from_dsdl(self) -> Response:
        start_time = monotonic()
        if (
            self.state.known_datatypes
            and self.state.last_known_datatypes_fetch_time
            and self.state.allowed_datatypes_validity_time + self.state.last_known_datatypes_fetch_time > monotonic()
        ):
            return self.state.known_datatypes
        try:
            # iterate through the paths in PYTHONPATH
            dsdl_folders = []
            # If the CYPHAL_PATH environment variable is set, add the value of that to the list of dsdl_folders
            # if "CYPHAL_PATH" in os.environ:
            #     dsdl_folders.append(Path(os.environ["CYPHAL_PATH"]))
            for path in sys.path:
                # if the path contains .compiled (which is our dsdl folder) then
                if ".compiled" in path:
                    dsdl_folders.append(Path(path))
                    break
            final_return_object: typing.Any = {}
            for dsdl_folder in dsdl_folders:
                final_return_object = {**final_return_object, **get_datatype_return_dto(get_all_datatypes(dsdl_folder))}
            final_json = jsonify(final_return_object)
            self.state.known_datatypes = final_json
            self.state.last_known_datatypes_fetch_time = monotonic()
            return final_json
        except Exception as e:
            logger.error("Failed to get known datatypes from dsdl.")
            tb = traceback.format_exc()
            logger.error(str(tb))
            return jsonify({"success": False, "message": tb})

    def setting_was_removed(self, id: str) -> Response:
        try:
            removed_descendant = self.state.settings.remove_descendant_with_id(id)
            if removed_descendant is not None:
                return jsonify({"success": True, "id": id, "value": removed_descendant})
            else:
                return jsonify({"success": False})
        except Exception as e:
            logger.error("Failed to remove setting.")
            tb = traceback.format_exc()
            logger.error(str(tb))
            return jsonify({"success": False, "message": tb})

    def setting_was_changed(self, id: str, value: str) -> Response:
        try:
            found_descendant = self.state.settings.get_descendant_with_id(id)
            if found_descendant:
                found_descendant.value = value
                return jsonify({"success": True, "id": id, "value": value})
            else:
                logger.error("Could not find descendant with id " + id)
            return jsonify({"success": False})
        except Exception as e:
            logger.error("Failed to change setting.")
            tb = traceback.format_exc()
            logger.error(str(tb))
            return jsonify({"success": False, "message": tb})

    def array_item_was_added(self, parent_id: str, value: str, own_id: str) -> Response:
        try:

            def append_value_to_parent(_value: str, parent: ReactiveValue) -> None:
                if isinstance(_value, str):
                    try:
                        value_object = json.loads(value)
                    except:
                        value_object = _value
                else:
                    value_object = _value
                current_reactive_value_object = ReactiveValue(value_object)
                recursive_reactivize_settings(current_reactive_value_object, parent)
                parent.value.append(own_id)
                parent.value.append(current_reactive_value_object)

            found_parent = self.state.settings.get_descendant_with_id(parent_id)
            if found_parent:
                append_value_to_parent(value, found_parent)
                return jsonify({"success": True, "parent_id": parent_id, "value": value})
            else:
                logger.error(f"Could not find parent with id {parent_id}")
            return jsonify({"success": False})
        except Exception as e:
            logger.error("Failed to add array item.")
            tb = traceback.format_exc()
            logger.error(str(tb))
            return jsonify({"success": False, "message": tb})

    def get_settings(self) -> Response:
        try:
            serialized_settings = jsonify(self.state.settings)
            return serialized_settings
        except Exception as e:
            logger.error("Failed to get settings.")
            tb = traceback.format_exc()
            logger.error(str(tb))
            return jsonify({"success": False, "message": tb})

    def save_settings(self) -> None:
        try:
            save_settings(self.state.settings, Path.home() / ".zubax" / "yukon" / "yukon_settings.yaml", self.state)
        except Exception as e:
            logger.error("Failed to save settings.")
            tb = traceback.format_exc()
            logger.error(str(tb))

    def load_settings(self) -> None:
        try:
            loading_settings_into_yukon(self.state)
        except Exception as e:
            logger.error("Failed to load settings.")
            tb = traceback.format_exc()
            logger.error(str(tb))

    def set_dronecan_fw_substitution_enabled(self, enabled: bool) -> None:
        self.state.dronecan.firmware_update_enabled.value = enabled

    def set_dronecan_fw_substitution_path(self, path: str) -> None:
        self.state.dronecan.firmware_update_path.value = path

    def set_dronecan_enabled(self, enabled: bool) -> None:
        self.state.dronecan.enabled.value = enabled

    def get_dronecan_node_entries(self) -> Response:
        return jsonify(list(self.state.dronecan.all_entries))

    def dronecan_node_fw_update(self, node_id: int, path: str) -> None:
        try:
            self.state.dronecan.firmware_update_path.value = path
            req = dronecan.uavcan.protocol.file.BeginFirmwareUpdate.Request()
            req.image_file_remote_path.path = "a"
            logging.debug("Sending %r to %r", req, node_id)
            self.state.dronecan.node.request(req, node_id, lambda e: None)
        except Exception as e:
            logger.error("Failed to send firmware update request.")
            tb = traceback.format_exc()
            logger.error(str(tb))
