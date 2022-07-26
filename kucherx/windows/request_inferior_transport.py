import asyncio
import logging
import time
import typing

from serial.tools import list_ports

from kucherx.domain.UID import UID
from kucherx.domain.attach_transport_request import AttachTransportRequest
from kucherx.domain.interface import Interface
from kucherx.domain.kucherx_state import KucherXState

import re

from kucherx.services.folder_recognition.common_folders import get_root_directory


def update_list_of_comports(dpg: typing.Any, combobox: UID) -> None:
    ports = list_ports.comports()
    dpg.configure_item(combobox, items=ports)


def make_request_inferior_transport_window(
    dpg: typing.Any,
    state: KucherXState,
    notify_transport_added: typing.Callable[[AttachTransportRequest], None],
    notify_transport_removed: typing.Callable[[AttachTransportRequest], None],
) -> UID:
    with dpg.window(label="Configure interface", width=560, height=540, no_close=False) as current_window_id:
        dpg.bind_font(state.default_font)
        dpg.set_exit_callback(notify_transport_removed)
        interface: Interface = Interface()
        input_field_width = 490
        dpg.add_text("Maximum transmission unit (MTU)")
        tf_mtu = None
        slcan_port_selection_combobox = None
        time_modified = time.time()

        def new_text_entered() -> None:
            """This would work is dpg.set_value worked"""
            nonlocal time_modified, tf_mtu, dpg
            if time.time() - time_modified > 0.06:
                current_value = dpg.get_value(tf_mtu)
                # Replace all nondecimals with nothing
                new_value = re.sub("\\D", "", current_value)
                print("New value " + new_value)
                time_modified = time.time()
                if dpg.get_value(tf_mtu) != new_value:
                    dpg.set_value(tf_mtu, new_value)

        tf_mtu = dpg.add_input_text(default_value="8", width=input_field_width, callback=new_text_entered)

        def interface_selected_from_combobox(sender: UID, app_data: str) -> None:
            """When an slcan interface is selected then the name of the interface will arrive as app_data"""
            # state.settings.UAVCAN__CAN__IFACE = "slcan:" + str(app_data).split()[0]
            # The name of the interface is displayed on the title bar of the window
            dpg.configure_item(current_window_id, label=app_data)
            interface.iface = "slcan:" + str(app_data).split()[0]

        slcan_group = None
        candump_group = None
        combobox_options = ["slcan", "candump"]
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
            elif item_selected == "3rd":
                pass
                # dpg.show_item(third_group)

        combobox_connection_method = dpg.add_combo(
            default_value="Select connection method",
            width=input_field_width,
            callback=connection_method_selected,
            items=combobox_options,
        )

        def update_combobox() -> None:
            update_list_of_comports(dpg, slcan_port_selection_combobox)

        with dpg.group(horizontal=False) as slcan_group:
            interface_combobox_text = dpg.add_text("Interface")
            slcan_port_selection_combobox = dpg.add_combo(
                default_value="Select an interface", width=input_field_width, callback=interface_selected_from_combobox
            )
            with dpg.group(horizontal=True) as combobox_action_group:
                dpg.add_button(label="Refresh", callback=update_combobox)
        with dpg.group(horizontal=False) as candump_group:

            def get_candump_files() -> typing.List[str]:
                from os import listdir
                from os.path import isfile, join

                root_dir = get_root_directory()
                return [f for f in listdir(root_dir) if isfile(join(root_dir, f)) and ".candump" in f]

            interface_combobox_text = dpg.add_text("Candump path")
            candump_files_select_combobox = None
            tb_candump_path = dpg.add_input_text(default_value="candump:path", width=input_field_width)

            def file_selected(file_name: str) -> None:
                print("File name: " + file_name)

            candump_files_select_combobox = dpg.add_combo(
                default_value="Search not performed",
                width=input_field_width,
                callback=file_selected,
                items=get_candump_files(),
            )

            def use_combobox() -> None:
                """The user can select to see candump files located around the KucherX executable."""
                dpg.hide_item(tb_candump_path)
                dpg.show_item(candump_files_select_combobox)
                items = get_candump_files()
                dpg.configure_item(candump_files_select_combobox, default_value=f"{len(items)} files found.")
                dpg.configure_item(candump_files_select_combobox, items=items)

            def use_textbox() -> None:
                """The user can select to use just a text as the path to a candump file."""
                dpg.hide_item(candump_files_select_combobox)
                dpg.show_item(tb_candump_path)

            with dpg.group(horizontal=False) as combobox_action_group:
                dpg.add_button(label="Look for .candump files around KucherX", callback=use_combobox)
                dpg.add_button(label="Just type paste in the path of a candump", callback=use_textbox)

            dpg.hide_item(candump_files_select_combobox)
            dpg.show_item(tb_candump_path)

        groups = [slcan_group, candump_group]
        connection_method_selected(None, "slcan")

        dpg.add_text("Arbitration bitrate")
        tf_arb_rate = dpg.add_input_text(default_value="1000000", width=input_field_width)
        dpg.add_text("Data bitrate")
        tf_data_rate = dpg.add_input_text(default_value="1000000", width=input_field_width)

        def finalize() -> None:
            if interface.iface == "":
                state.errors_queue.put("No interface selected")
            try:
                interface.mtu = int(dpg.get_value(tf_mtu))
                interface.rate_arb = int(dpg.get_value(tf_arb_rate))
                interface.rate_data = int(dpg.get_value(tf_data_rate))
                notify_transport_added(interface)
            except ValueError as e:
                state.errors_queue.put(e)

        dpg.add_button(label="Add interface", callback=finalize)

        update_combobox()
    return current_window_id
