import json
import os
import re
import typing
import webbrowser
from pathlib import Path
from time import sleep, monotonic
import logging
import yaml

try:
    from yaml import CLoader as Loader, CDumper as Dumper
except ImportError:
    from yaml import Loader, Dumper  # type: ignore
import websockets
import uavcan
from domain.reread_registers_request import RereadRegistersRequest
from yukon.domain.apply_configuration_request import ApplyConfigurationRequest
from yukon.services.get_ports import get_socketcan_ports, get_slcan_ports
from yukon.domain.attach_transport_request import AttachTransportRequest
from yukon.domain.interface import Interface
from yukon.domain.update_register_request import UpdateRegisterRequest
from yukon.domain.avatar import Avatar
from yukon.services.value_utils import unexplode_value, explode_value
from yukon.domain.god_state import GodState
from yukon.services.get_electron_path import get_electron_path
from yukon.domain.command_send_request import CommandSendRequest
from yukon.domain.command_send_response import CommandSendResponse
from yukon.domain.reread_register_names_request import RereadRegisterNamesRequest

from yukon.services.enhanced_json_encoder import EnhancedJSONEncoder

logger = logging.getLogger(__file__)
logger.setLevel(logging.NOTSET)


def save_text_into_file(file_contents: str) -> None:
    import tkinter
    import tkinter as tk
    from tkinter.filedialog import SaveAs

    root = tk.Tk()
    root.geometry("1x1+0+0")
    root.eval("tk::PlaceWindow . center")
    second_win = tkinter.Toplevel(root)
    second_win.withdraw()
    root.eval(f"tk::PlaceWindow {str(second_win)} center")
    # Show window again and lift it to top so it can get focus,
    # otherwise dialogs will end up behind the terminal.
    root.deiconify()
    root.lift()
    root.focus_force()
    save_as_dialog = SaveAs(root)
    file_path = save_as_dialog.show()
    root.withdraw()
    root.destroy()
    if file_path:
        with open(file_path, "w") as f:
            f.write(file_contents)
    else:
        logger.warning("No file selected")


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
    prototype = unexplode_value(avatar.register_exploded_values[register_name])
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
                    simplified_value2 = json.loads(json.dumps(simplified_value))
                    prototype = unexplode_value(avatar.register_exploded_values[register_name])
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


class SendingApi:
    async def send_message(self, message: typing.Any) -> None:
        async with await websockets.connect("ws://localhost:8765/hello") as websocket:
            await websocket.send("Hello world!")
            await websocket.recv()


class Api:
    last_avatars: typing.List[Avatar] = []

    def __init__(self, state: GodState):
        self.state = state
        self.last_avatars = []

    def get_socketcan_ports(self) -> str:
        _list = get_socketcan_ports()
        return json.dumps(_list)

    def get_slcan_ports(self) -> str:
        _list = get_slcan_ports()
        return json.dumps(_list)

    def add_local_message(self, message: str) -> None:
        logger.info(message)

    def save_yaml(self, text: str, convert_to_numbers: bool = True) -> None:
        new_text = make_yaml_string_node_ids_numbers(text)
        if not convert_to_numbers:
            save_text_into_file(text)
            return
        save_text_into_file(new_text)

    def save_text(self, text: str) -> None:
        save_text_into_file(text)

    def save_all_of_register_configuration(self, serialized_configuration: str) -> None:
        save_text_into_file(serialized_configuration)

    def import_all_of_register_configuration(self) -> str:
        return import_candump_file_contents()

    def import_node_configuration(self) -> str:
        return import_candump_file_contents()

    def is_configuration_simplified(self, deserialized_configuration: typing.Any) -> str:
        return json.dumps(is_configuration_simplified(deserialized_configuration))

    def is_network_configuration(self, deserialized_configuration: typing.Any) -> str:
        value = is_network_configuration(deserialized_configuration)
        return json.dumps(value)

    def apply_configuration_to_node(self, node_id: int, configuration: str) -> None:
        request = ApplyConfigurationRequest(node_id, configuration, is_network_configuration(configuration))
        self.state.queues.apply_configuration.put(request)

    def apply_all_of_configuration(self, configuration: str) -> None:
        request = ApplyConfigurationRequest(None, configuration, is_network_configuration(configuration))
        self.state.queues.apply_configuration.put(request)

    def simplify_configuration(self, configuration: str) -> str:
        if isinstance(configuration, str):
            # if the first character in deserialize_conf is a {, then it is a JSON string.
            if configuration[0] == "{":
                deserialized_conf = json.loads(configuration)
            else:
                deserialized_conf = yaml.load(configuration, Loader=Loader)
        simplified_configuration_string = simplify_configuration(deserialized_conf)
        return simplified_configuration_string

    def unsimplify_configuration(self, configuration: str) -> str:
        if isinstance(configuration, str):
            # if the first character in deserialize_conf is a {, then it is a JSON string.
            if configuration[0] == "{":
                deserialized_conf = json.loads(configuration)
            else:
                deserialized_conf = yaml.load(configuration, Loader=Loader)
        return unsimplify_configuration(self.state.avatar.avatars_by_node_id, deserialized_conf)

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

    def update_register_value(self, register_name: str, register_value: str, node_id: str) -> None:
        # Check if register_value can be converted to an int, is purely numeric
        new_value: uavcan.register.Value_1 = unexplode_value(register_value)
        self.state.queues.update_registers.put(UpdateRegisterRequest(register_name, new_value, int(node_id)))

    def attach_udp_transport(self, udp_iface: str, udp_mtu: int, node_id: int) -> str:
        logger.info(f"Attaching UDP transport to {udp_iface}")
        interface = Interface()
        interface.udp_iface = udp_iface
        interface.udp_mtu = int(udp_mtu)
        interface.is_udp = True
        atr: AttachTransportRequest = AttachTransportRequest(interface, int(node_id))
        self.state.queues.attach_transport.put(atr)
        while True:
            if self.state.queues.attach_transport_response.empty():
                sleep(0.1)
            else:
                break
        return json.dumps(self.state.queues.attach_transport_response.get(), cls=EnhancedJSONEncoder)

    def attach_transport(self, interface_string: str, arb_rate: str, data_rate: str, node_id: str, mtu: str) -> str:
        logger.info(f"Attach transport request: {interface_string}, {arb_rate}, {data_rate}, {node_id}, {mtu}")
        interface = Interface()
        interface.rate_arb = int(arb_rate)
        interface.rate_data = int(data_rate)
        interface.mtu = int(mtu)
        interface.iface = interface_string

        atr: AttachTransportRequest = AttachTransportRequest(interface, int(node_id))
        self.state.queues.attach_transport.put(atr)
        while True:
            if self.state.queues.attach_transport_response.empty():
                sleep(0.1)
            else:
                break
        return json.dumps(self.state.queues.attach_transport_response.get(), cls=EnhancedJSONEncoder)

    def detach_transport(self, hash: str) -> typing.Any:
        logger.info(f"Detaching transport {hash}")
        self.state.queues.detach_transport.put(hash)
        while True:
            if self.state.queues.detach_transport_response.empty():
                sleep(0.1)
            else:
                break
        return self.state.queues.detach_transport_response.get()

    # def save_registers_of_node(self, node_id: int, registers: typing.Dict["str"]) -> None:
    def show_yakut(self) -> None:
        self.state.avatar.hide_yakut_avatar = False

    def reread_registers(self, request_contents: dict) -> None:
        request = RereadRegistersRequest(request_contents)
        self.state.queues.reread_registers.put(request)

    def hide_yakut(self) -> None:
        self.state.avatar.hide_yakut_avatar = True

    def get_messages(self, since_index: int = 0) -> str:
        my_list = [
            x.asdict() for x in list(self.state.queues.messages.queue) if not since_index or x.index_nr >= since_index
        ]
        messages_serialized = json.dumps(my_list)
        return messages_serialized

    def get_avatars(self) -> str:
        self.state.gui.last_poll_received = monotonic()
        avatar_list = [avatar.to_builtin() for avatar in list(self.state.avatar.avatars_by_node_id.values())]
        avatar_dto = {"avatars": avatar_list, "hash": hash(json.dumps(avatar_list, sort_keys=True))}
        if self.state.avatar.hide_yakut_avatar:
            for avatar in avatar_list:
                amount_of_subscriptions = len(avatar["ports"]["sub"])
                if avatar["name"] and avatar["name"] == "yakut":
                    avatar_list.remove(avatar)
                elif amount_of_subscriptions == 8192:  # only yakut subscribes to every port number
                    avatar_list.remove(avatar)
        return_string = json.dumps(avatar_dto, cls=EnhancedJSONEncoder)
        return return_string

    def set_log_level(self, severity: str) -> None:
        self.state.gui.message_severity = severity

    def get_connected_transport_interfaces(self) -> str:
        composed_list = [x.to_builtin() for x in self.state.cyphal.transports_list]
        return json.dumps({"interfaces": composed_list, "hash": hash(json.dumps(composed_list, sort_keys=True))})

    def send_command(self, node_id: str, command: str, text_argument: str) -> typing.Any:
        send_command_request = CommandSendRequest(int(node_id), int(command), text_argument)
        self.state.queues.send_command.put(send_command_request)
        while True:
            if self.state.queues.command_response.empty():
                sleep(0.1)
            else:
                break
        command_response = self.state.queues.command_response.get()
        return {"success": command_response.is_success, "message": command_response.message}

    def reread_node(self, node_id: str) -> None:
        node_id_as_int = int(node_id)
        if node_id_as_int:
            self.state.queues.reread_register_names.put(RereadRegisterNamesRequest(node_id_as_int))
