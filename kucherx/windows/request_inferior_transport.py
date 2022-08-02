import logging
import typing

from kucherx.domain.UID import UID
from kucherx.domain.attach_transport_request import AttachTransportRequest
from kucherx.domain.interface import Interface
from kucherx.domain.god_state import GodState

from kucherx.windows.group_candump import make_candump_group
from kucherx.windows.group_slcan import make_slcan_group
from kucherx.windows.group_socketcan import make_socketcan_group

logger = logging.getLogger(__name__)


def make_request_inferior_transport_window(
    dpg: typing.Any,
    state: GodState,
    notify_transport_requested: typing.Callable[[AttachTransportRequest], None],
    notify_transport_removal: typing.Callable[[AttachTransportRequest], None],
) -> UID:
    with dpg.window(label="Configure interface", width=560, height=595, no_close=False) as current_window_id:
        dpg.bind_font(state.gui.default_font)
        dpg.set_exit_callback(notify_transport_removal)
        interface: Interface = Interface()
        input_field_width = 490
        dpg.add_text("Maximum transmission unit (MTU)")
        tf_mtu = dpg.add_input_text(width=input_field_width, default_value="8")

        combobox_options = ["slcan", "candump", "socketcan"]
        groups: typing.Optional[typing.List[UID]] = None

        dpg.add_text("The kind of connection")

        def connection_method_selected(sender: UID, item_selected: str) -> None:
            """There are currently three connection methods, I forgot the name of the third one."""
            nonlocal groups
            if groups:
                for group in groups:
                    dpg.hide_item(group)
            if item_selected == "slcan":
                dpg.show_item(slcan_group)
            elif item_selected == "candump":
                dpg.show_item(candump_group)
            elif item_selected == "socketcan":
                dpg.show_item(socketcan_group)

        combobox_connection_method = dpg.add_combo(
            default_value="Select connection method",
            width=input_field_width,
            callback=connection_method_selected,
            items=combobox_options,
        )
        slcan_group = make_slcan_group(dpg, input_field_width, current_window_id, interface, state)
        candump_group = make_candump_group(dpg, input_field_width, current_window_id, interface, state)
        socketcan_group = make_socketcan_group(dpg, input_field_width, current_window_id, interface, state)
        groups = [slcan_group, candump_group, socketcan_group]
        connection_method_selected(None, "slcan")

        dpg.add_text("Arbitration bitrate")
        tf_arb_rate = dpg.add_input_text(default_value="1000000", width=input_field_width)
        dpg.add_text("Data bitrate")
        tf_data_rate = dpg.add_input_text(default_value="1000000", width=input_field_width)

        def finalize() -> None:
            if interface.iface == "":
                state.queues.messages_queue.put("No interface selected")
            try:
                interface.mtu = int(dpg.get_value(tf_mtu))
                interface.rate_arb = int(dpg.get_value(tf_arb_rate))
                interface.rate_data = int(dpg.get_value(tf_data_rate))
                logger.info("Notifying that transport was added")
                dpg.configure_item(add_interface_button, enabled=False)
            except ValueError as e:
                state.queues.messages_queue.put(e)

        dpg.add_checkbox(label="Notify when transmissions are received")

        add_interface_button = dpg.add_button(label="Add interface", callback=finalize)
    return current_window_id
