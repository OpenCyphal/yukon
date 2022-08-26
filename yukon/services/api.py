import json
import typing
import copy
import webbrowser
from pathlib import Path
from time import sleep
import logging

import uavcan
from yukon.domain.apply_configuration_request import ApplyConfigurationRequest
from yukon.services.get_ports import get_socketcan_ports, get_slcan_ports
from yukon.domain.attach_transport_request import AttachTransportRequest
from yukon.domain.interface import Interface
from yukon.domain.update_register_request import UpdateRegisterRequest
from yukon.domain.avatar import Avatar
from yukon.services.value_utils import unexplode_value
from yukon.domain.god_state import GodState

from yukon.services.enhanced_json_encoder import EnhancedJSONEncoder

logger = logging.getLogger(__file__)
logger.setLevel(logging.NOTSET)


def save_text_into_file(file_contents):
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.geometry('1x1+1+1')

    # Show window again and lift it to top so it can get focus,
    # otherwise dialogs will end up behind the terminal.
    root.deiconify()
    root.lift()
    root.focus_force()
    file_path = filedialog.asksaveasfilename(filetypes=[("Candump files", ".candump .txt .json")])
    root.withdraw()
    root.destroy()
    if file_path:
        with open(file_path, "w") as f:
            f.write(file_contents)
    else:
        logger.warning("No file selected")


def import_candump_file_contents():
    import tkinter as tk
    from tkinter import filedialog
    root = tk.Tk()
    root.geometry('1x1+1+1')
    root.deiconify()
    root.lift()
    root.focus_force()
    file_path = filedialog.askopenfilename(filetypes=[("Candump files", ".candump .txt .json")])
    root.withdraw()
    root.destroy()
    try:
        with open(file_path, "r") as f:
            contents = f.read()
            contents_deserialized = json.loads(contents)
            contents_deserialized["__file_name"] = Path(file_path).name
            configuration = json.dumps(contents_deserialized)
    except Exception:
        logger.exception("Nothing was selected from the file dialog")
        return ""
    else:
        logger.debug(f"Configuration: {configuration}")
    return configuration


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

    def save_text(self, text):
        save_text_into_file(text)

    def save_node_configuration(self, node_id, serialized_configuration):
        save_text_into_file(serialized_configuration)

    def save_all_of_register_configuration(self, serialized_configuration):
        save_text_into_file(serialized_configuration)

    def import_all_of_register_configuration(self):
        return import_candump_file_contents()

    def import_node_configuration(self):
        return import_candump_file_contents()

    def apply_configuration_to_node(self, node_id: int, configuration: str) -> None:
        self.state.queues.apply_configuration.put(ApplyConfigurationRequest(node_id, configuration))

    def apply_all_of_configuration(self, configuration: str) -> None:
        self.state.queues.apply_configuration.put(ApplyConfigurationRequest(None, configuration))

    def open_file_dialog(self) -> None:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()

        file_path = filedialog.askopenfilename(filetypes=[("Candump files", ".candump .txt .json")])
        _ = file_path

    def update_register_value(self, register_name: str, register_value: str, node_id: int) -> None:
        # Check if register_value can be converted to an int, is purely numeric
        new_value: uavcan.register.Value_1 = unexplode_value(register_value)
        self.state.queues.update_registers.put(UpdateRegisterRequest(register_name, new_value, node_id))

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

    # def save_registers_of_node(self, node_id: int, registers: typing.Dict["str"]) -> None:
    def show_yakut(self) -> None:
        self.state.avatar.hide_yakut_avatar = False

    def hide_yakut(self) -> None:
        self.state.avatar.hide_yakut_avatar = True

    def get_messages(self, since_index: int = 0) -> str:
        my_list = [x.asdict() for x in list(self.state.queues.messages.queue) if x.index_nr >= since_index]
        messages_serialized = json.dumps(my_list)
        return messages_serialized

    def get_avatars(self) -> str:
        avatar_list = [avatar.to_builtin() for avatar in list(self.state.avatar.avatars_by_node_id.values())]
        avatar_dto = {"avatars": avatar_list, "hash": hash(json.dumps(avatar_list, sort_keys=True))}
        if self.state.avatar.hide_yakut_avatar:
            for avatar in avatar_list:
                amount_of_subscriptions = len(avatar["ports"]["sub"])
                if avatar["name"] and avatar["name"] == "yakut":
                    avatar_list.remove(avatar)
                elif amount_of_subscriptions == 8192:  # only yakut subscribes to every port number
                    avatar_list.remove(avatar)
        return json.dumps(avatar_dto)

    def open_monitor_window(self) -> None:
        webbrowser.open_new_tab("http://localhost:5000/main")

    def open_add_transport_window(self) -> None:
        webbrowser.open_new_tab("http://localhost:5000/")
