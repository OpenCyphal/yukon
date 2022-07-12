import asyncio

from pycyphal.transport.can.media import Media
from pycyphal.transport.can.media.pythoncan import PythonCANMedia
from serial.tools import list_ports

from domain.Interface import Interface
from domain.KucherXState import KucherXState
from domain.WindowStyleState import WindowStyleState


def update_list_of_comports(dpg, combobox):
    ports = list_ports.comports()
    dpg.configure_item(combobox, items=ports)


from pycyphal.transport.can import CANTransport


def make_add_interface_window(dpg, state: KucherXState, logger, wss: WindowStyleState, interface_added_callback):
    with dpg.window(label="Configure interface", width=560, height=500, no_close=True) \
            as new_interface_window_id:
        interface: Interface = Interface()
        input_field_width = 490
        dpg.add_text("Maximum transmission unit (MTU)")
        tfMTU = dpg.add_input_text(default_value="8",
                                   width=input_field_width)

        def combobox_callback(sender, app_data):
            # state.settings.UAVCAN__CAN__IFACE = "slcan:" + str(app_data).split()[0]
            dpg.configure_item(new_interface_window_id, label=app_data)
            interface.iface = "slcan:" + str(app_data).split()[0]

        dpg.add_text("Interface")
        combobox = dpg.add_combo(default_value="Select an interface",
                                 width=input_field_width, callback=combobox_callback)

        def clear_combobox():
            dpg.configure_item(combobox, items=[])
            dpg.configure_item(combobox, default_value="")

        def update_combobox():
            update_list_of_comports(dpg, combobox)

        with dpg.group(horizontal=True) as combobox_action_group:
            dpg.add_button(label="Refresh", callback=update_combobox)
            dpg.add_button(label="Clear", callback=clear_combobox)
        dpg.add_text("Arbitration bitrate")
        tfArbRate = dpg.add_input_text(default_value="1000000",
                                       width=input_field_width)
        dpg.add_text("Data bitrate")
        tfDatarate = dpg.add_input_text(default_value="1000000",
                                        width=input_field_width)

        def finalize():
            interface.mtu = int(dpg.get_value(tfMTU))
            interface.rate_arb = int(dpg.get_value(tfArbRate))
            interface.rate_data = int(dpg.get_value(tfDatarate))
            interface_added_callback(interface)

        dpg.add_button(label="Finalize", callback=finalize)

        update_combobox()
