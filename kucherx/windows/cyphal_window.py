import asyncio
import dataclasses
import os
import pathlib
import time
from dataclasses import dataclass
import json
from serial.tools import list_ports

from domain.CyphalLocalNodeSettings import CyphalLocalNodeSettings
from make_node import make_node


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


async def update_list_of_comports(dpg, combobox):
    ports = list_ports.comports()
    dpg.configure_item(combobox, items=ports)


def make_cyphal_window(dpg, logger, default_font, settings: CyphalLocalNodeSettings, theme,
                       use_alternative_labels=True):
    labels = {"mtu": "   UAVCAN__CAN__MTU", "iface": "  UAVCAN__CAN__IFACE", "nodeid": "   UAVCAN__NODE__ID",
              "arbitration_bitrate": "   Arbitration bitrate", "data_bitrate": "   Data bitrate"}
    if use_alternative_labels:
        labels = {"mtu": "   Maximum transmission unit", "iface": "  Interface", "nodeid": "   Node id",
                  "arbitration_bitrate": "   Arbitration bitrate", "data_bitrate": "   Data bitrate"}
    with dpg.window(label="Cyphal settings", tag="CyphalConfig", width=400) as main_window_id:
        logger.warning(f"Main window id is {main_window_id}")
        dpg.bind_item_theme(main_window_id, theme)
        dpg.bind_font(default_font)

        def switch_to_monitor():
            dpg.hide_item(main_window_id)
            dpg.show_item("MonitorWindow")
            dpg.set_primary_window("MonitorWindow", True)

        dpg.add_button(label="Switch to monitor", callback=switch_to_monitor)
        dpg.add_text("Local node settings")
        input_field_width = 490
        dpg.add_input_text(label=labels["mtu"], default_value=str(settings.UAVCAN__CAN__MTU),
                           width=input_field_width)

        def combobox_callback(sender, app_data):
            settings.UAVCAN__CAN__IFACE = "slcan:" + str(app_data).split()[0]
            logger.info(f"New UAVCAN__CAN__IFACE is {settings.UAVCAN__CAN__IFACE}")

        with dpg.theme() as combobox_theme:
            with dpg.theme_component(dpg.mvAll):
                # cool color, maybe later?
                # dpg.add_theme_color(dpg.mvThemeCol_FrameBg, (255, 140, 23), category=dpg.mvThemeCat_Core)
                dpg.add_theme_style(dpg.mvStyleVar_WindowPadding, 0, 15, category=dpg.mvThemeCat_Core)
                dpg.add_theme_style(dpg.mvStyleVar_ItemInnerSpacing, 10, 10, category=dpg.mvThemeCat_Core)
        combobox = dpg.add_combo(label=labels["iface"], default_value=settings.UAVCAN__CAN__IFACE,
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
        dpg.add_input_text(label=labels["arbitration_bitrate"], default_value=str(settings.arbitration_bitrate),
                           width=input_field_width)
        dpg.add_input_text(label=labels["data_bitrate"], default_value=str(settings.data_bitrate),
                           width=input_field_width)
        dpg.add_input_text(label=labels["nodeid"], default_value=str(settings.UAVCAN__NODE__ID),
                           width=input_field_width)
        with dpg.group(horizontal=True) as error_group:
            width, height, channels, data = dpg.load_image(
                str((get_root_directory() / "kucherx/res/icons/png/warning_64.png").resolve()))

            with dpg.texture_registry(show=True):
                dpg.add_static_texture(width=width, height=height, default_value=data, tag="warning_image")
            warning_image_item_id = dpg.add_image("warning_image")
            lbl_error = dpg.add_text("", tag="lblError")
            warning_image_item_id2 = dpg.add_image("warning_image")
            dpg.hide_item(warning_image_item_id)
            dpg.hide_item(warning_image_item_id2)

        with dpg.group(horizontal=True) as group_save_launch:
            dpg.add_button(label="Save")

            def launch_node():
                if settings.UAVCAN__CAN__IFACE == "":
                    dpg.configure_item(lbl_error, default_value="You haven't set the interface.")
                    dpg.show_item(warning_image_item_id)
                    dpg.show_item(warning_image_item_id2)
                    return
                make_node(settings)
                dpg.configure_item(lbl_error, default_value="A reconfigurable node was launched.")
                # dpg.hide_item(warning_image_item_id)
                # dpg.hide_item(warning_image_item_id2)

            dpg.add_button(label="Launch node", callback=launch_node)

    return main_window_id


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if dataclasses.is_dataclass(o):
            return dataclasses.asdict(o)
        return super().default(o)


def save_cyphal_local_node_settings(settings: CyphalLocalNodeSettings):
    with open("settings.json", "w") as f:
        f.write(json.dumps(settings, cls=EnhancedJSONEncoder))
