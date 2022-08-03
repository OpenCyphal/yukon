import threading
import typing

from serial.tools import list_ports

from domain.god_state import GodState
from kucherx.domain.interface import Interface
from kucherx.domain import UID


def make_slcan_group(
        dpg: typing.Any, input_field_width: int, current_window_id: UID, interface: Interface, state: GodState
) -> UID:
    combobox_action_group = None

    def update_combobox() -> None:
        def _internal():
            ports = list_ports.comports()
            dpg.configure_item(slcan_port_selection_combobox, items=ports)
        threading.Thread(target=_internal).start()

    def interface_selected_from_combobox(sender: UID, app_data: str) -> None:
        """When an slcan interface is selected then the name of the interface will arrive as app_data"""
        # state.settings.UAVCAN__CAN__IFACE = "slcan:" + str(app_data).split()[0]
        # The name of the interface is displayed on the title bar of the window
        dpg.configure_item(current_window_id, label=app_data)
        interface.iface = "slcan:" + str(app_data).split()[0]

    with dpg.group(horizontal=False) as slcan_group:
        dpg.add_text("Interface")
        slcan_port_selection_combobox = dpg.add_combo(
            default_value="Select an slcan interface",
            width=input_field_width,
            callback=interface_selected_from_combobox,
        )
        with dpg.group(horizontal=True) as combobox_action_group:
            dpg.add_button(label="Refresh", callback=update_combobox)
    update_combobox()
    return slcan_group
