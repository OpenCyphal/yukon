import asyncio
import dataclasses
import os
import pathlib
import time
from dataclasses import dataclass
import json
from serial.tools import list_ports

from domain.KucherXState import KucherXState
from domain.WindowStyleState import WindowStyleState
from make_node_debugger import make_node


def get_root_directory():
    from os.path import exists
    current = pathlib.Path(__file__).parent
    time_started = time.time()
    while time_started - time.time() < 0.1:
        if exists(current / "LICENSE") or exists(current / ".gitignore"):
            return current.resolve()
        else:
            current = current.parent
    return None

def make_interface_config_window(dpg, logger, state: KucherXState, wss: WindowStyleState):
    with dpg.window(label="Cyphal settings", tag="CyphalConfig", width=400) as main_window_id:
        logger.warning(f"Main window id is {main_window_id}")
        dpg.bind_item_theme(main_window_id, wss.theme)
        dpg.bind_font(wss.font)

        def switch_to_monitor():
            dpg.hide_item(main_window_id)
            dpg.show_item("MonitorWindow")
            dpg.set_primary_window("MonitorWindow", True)

        def add_interface():
            pass

        with dpg.texture_registry(show=False):
            width, height, channels, data = dpg.load_image(
                str((get_root_directory() / "kucherx/res/icons/png/monitor_32.png").resolve()))
            dpg.add_static_texture(width=width, height=height, default_value=data, tag="monitor_image")
        with dpg.texture_registry(show=False):
            width, height, channels, data = dpg.load_image(
                str((get_root_directory() / "kucherx/res/icons/png/plus.png").resolve()))
            dpg.add_static_texture(width=width, height=height, default_value=data, tag="plus_image")
        with dpg.group(horizontal=True) as toolbar_group:
            dpg.add_image_button(label="Add interface", callback=add_interface(), texture_tag="plus_image")
            dpg.add_image_button(label="Switch to monitor", callback=switch_to_monitor, texture_tag="monitor_image")
        dpg.add_text("Local node settings")
        input_field_width = 490
        dpg.add_input_text(label="Maximum transmission unit (MTU)", default_value=str(state.settings.UAVCAN__CAN__MTU),
                           width=input_field_width)

        def combobox_callback(sender, app_data):
            state.settings.UAVCAN__CAN__IFACE = "slcan:" + str(app_data).split()[0]
            logger.info(f"New UAVCAN__CAN__IFACE is {state.settings.UAVCAN__CAN__IFACE}")

        with dpg.theme() as combobox_theme:
            with dpg.theme_component(dpg.mvAll):
                # cool color, maybe later?
                # dpg.add_theme_color(dpg.mvThemeCol_FrameBg, (255, 140, 23), category=dpg.mvThemeCat_Core)
                dpg.add_theme_style(dpg.mvStyleVar_WindowPadding, 0, 15, category=dpg.mvThemeCat_Core)
                dpg.add_theme_style(dpg.mvStyleVar_ItemInnerSpacing, 10, 10, category=dpg.mvThemeCat_Core)
        combobox = dpg.add_combo(label="Interface", default_value=state.settings.UAVCAN__CAN__IFACE,
                                 width=input_field_width, callback=combobox_callback)

        def clear_combobox():
            dpg.configure_item(combobox, items=[])
            dpg.configure_item(combobox, default_value="")

        def update_combobox():
            asyncio.run(update_list_of_comports(dpg, combobox))

        with dpg.group(horizontal=True) as combobox_action_group:
            dpg.add_button(label="Refresh", callback=update_combobox)
            dpg.add_button(label="Clear", callback=clear_combobox)
        update_combobox()
        dpg.bind_item_theme(combobox, combobox_theme)
        dpg.add_input_text(label="Arbitration bitrate", default_value=str(state.settings.arbitration_bitrate),
                           width=input_field_width)
        dpg.add_input_text(label="Data bitrate", default_value=str(state.settings.data_bitrate),
                           width=input_field_width)
        dpg.add_input_text(label="Node id", default_value=str(state.settings.UAVCAN__NODE__ID),
                           width=input_field_width)
        with dpg.group(horizontal=True) as error_group:
            dpg.add_text("")  # This is a workaround for the bug below with images hidden and shown
            with dpg.texture_registry(show=False):
                width, height, channels, data = dpg.load_image(
                    str((get_root_directory() / "kucherx/res/icons/png/warning_64.png").resolve()))
                dpg.add_static_texture(width=width, height=height, default_value=data, tag="warning_image")

            with dpg.texture_registry(show=False):
                width, height, channels, data = dpg.load_image(
                    str((get_root_directory() / "kucherx/res/icons/png/success_64.png").resolve()))
                dpg.add_static_texture(width=width, height=height, default_value=data, tag="success_image")
            warning_image_item_id = dpg.add_image("warning_image")
            success_image_item_id = dpg.add_image("success_image")
            lbl_error = dpg.add_text("", tag="lblError")
            warning_image_item_id2 = dpg.add_image("warning_image")
            success_image_item_id2 = dpg.add_image("success_image")
            dpg.hide_item(warning_image_item_id)
            dpg.hide_item(warning_image_item_id2)
            dpg.hide_item(success_image_item_id)
            dpg.hide_item(success_image_item_id2)

        with dpg.group(horizontal=True) as group_save_launch:
            dpg.add_button(label="Save")

            def launch_node():
                if state.settings.UAVCAN__CAN__IFACE == "":
                    dpg.configure_item(lbl_error, default_value="You haven't set the interface.")
                    dpg.show_item(warning_image_item_id)
                    dpg.show_item(warning_image_item_id2)
                    return
                make_node(state)
                dpg.configure_item(lbl_error, default_value="A reconfigurable node was launched.")
                # dpg.show_item(error_group)
                dpg.hide_item(warning_image_item_id)  # unable due to a bug in dearpygui, fix the bug and uncomment
                # dpg.show_item(warning_image_item_id)
                dpg.hide_item(warning_image_item_id2)
                dpg.show_item(success_image_item_id)
                dpg.show_item(success_image_item_id2)

    return main_window_id


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if dataclasses.is_dataclass(o):
            return dataclasses.asdict(o)
        return super().default(o)


# def save_cyphal_local_node_settings(settings: CyphalLocalNodeSettings):
#     with open("settings.json", "w") as f:
#         f.write(json.dumps(settings, cls=EnhancedJSONEncoder))
