import asyncio
import dataclasses
import os
from dataclasses import dataclass
import json
from serial.tools import list_ports


@dataclass
class CyphalLocalNodeSettings:
    UAVCAN__CAN__MTU: int
    UAVCAN__CAN__IFACE: str
    UAVCAN__NODE__ID: int


import pycyphal.application


async def update_list_of_comports(dpg, combobox):
    ports = list_ports.comports()
    dpg.configure_item(combobox, items=ports)


def make_transport(settings: CyphalLocalNodeSettings):
    import pycyphal
    import pycyphal.application
    settings_dictionary = dataclasses.asdict(settings)
    new_settings_dictionary = {}
    for key, value in settings_dictionary.items():
        new_settings_dictionary[str(key)] = str(value)
    registry = pycyphal.application.make_registry(environment_variables=new_settings_dictionary)
    transport = pycyphal.application.make_transport(registers=registry, reconfigurable=True)


def make_cyphal_window(dpg, logger, default_font, settings: CyphalLocalNodeSettings, theme, use_alternative_labels=True):
    labels={"mtu": "   UAVCAN__CAN__MTU", "iface": "  UAVCAN__CAN__IFACE", "nodeid": "   UAVCAN__NODE__ID"}
    if use_alternative_labels:
        labels={"mtu": "   Maximum transmission unit", "iface": "  Interface", "nodeid": "   Node id"}
    with dpg.window(label="Cyphal settings", tag="Primary Window", width=400) as main_window_id:
        logger.warning(f"Main window id is {main_window_id}")
        dpg.bind_item_theme(main_window_id, theme)
        dpg.bind_font(default_font)
        dpg.add_text("Local node settings")
        input_field_width = 490
        dpg.add_input_text(label=labels["mtu"], default_value=str(settings.UAVCAN__CAN__MTU),
                           width=input_field_width)
        with dpg.theme() as combobox_theme:
            with dpg.theme_component(dpg.mvAll):
                # cool color, maybe later?
                # dpg.add_theme_color(dpg.mvThemeCol_FrameBg, (255, 140, 23), category=dpg.mvThemeCat_Core)
                dpg.add_theme_style(dpg.mvStyleVar_WindowPadding, 0, 15, category=dpg.mvThemeCat_Core)
                dpg.add_theme_style(dpg.mvStyleVar_ItemInnerSpacing, 10, 10, category=dpg.mvThemeCat_Core)
        combobox = dpg.add_combo(label=labels["iface"], default_value=settings.UAVCAN__CAN__IFACE,
                                 width=input_field_width)
        asyncio.run(update_list_of_comports(dpg, combobox))
        dpg.bind_item_theme(combobox, combobox_theme)
        dpg.add_input_text(label=labels["nodeid"], default_value=str(settings.UAVCAN__NODE__ID),
                           width=input_field_width)
        dpg.add_button(label="Save")
    return main_window_id


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if dataclasses.is_dataclass(o):
            return dataclasses.asdict(o)
        return super().default(o)


def save_cyphal_local_node_settings(settings: CyphalLocalNodeSettings):
    with open("settings.json", "w") as f:
        f.write(json.dumps(settings, cls=EnhancedJSONEncoder))
