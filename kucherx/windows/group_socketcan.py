import os
import subprocess

from domain.god_state import GodState
from kucherx.domain.interface import Interface
from kucherx.domain import UID

import platform


def make_socketcan_group(dpg, input_field_width, current_window_id: UID, interface: Interface, state: GodState):
    def make_update_combobox_callback(combobox: UID):
        def update_combobox():
            if platform.system() == "Linux":
                result = subprocess.run(["netstat -i | tail -n +3 |cut -d\" \" -f1"], shell=True,
                                        stdout=subprocess.PIPE)
                list_of_interfaces = result.stdout.decode("utf-8").strip().split("\n")
                dpg.configure_item(combobox, items=list_of_interfaces)
            else:
                dpg.configure_item(combobox, items=["Socketcan doesn't work on Windows", "use slcan"])
                state.messages_queue.put("Socketcan doesn't work on Windows use slcan")
        return update_combobox

    def interface_selected_from_combobox(sender: UID, app_data: str) -> None:
        """When an slcan interface is selected then the name of the interface will arrive as app_data"""
        # state.settings.UAVCAN__CAN__IFACE = "slcan:" + str(app_data).split()[0]
        # The name of the interface is displayed on the title bar of the window
        dpg.configure_item(current_window_id, label=app_data)
        interface.iface = "slcan:" + str(app_data).split()[0]

    with dpg.group(horizontal=False) as socketcan_group:
        if os.name == "nt":
            dpg.add_text("Socketcan is not supported on Windows platforms.")
        else:
            dpg.add_text("Interface")
            socketcan_port_selection_combobox = dpg.add_combo(
                default_value="Select a socketcan interface", width=input_field_width,
                callback=interface_selected_from_combobox
            )
            with dpg.group(horizontal=True) as combobox_action_group:
                dpg.add_button(label="Refresh",
                               callback=make_update_combobox_callback(socketcan_port_selection_combobox)
                               )
    return socketcan_group
