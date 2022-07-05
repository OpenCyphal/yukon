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
    UAVCAN__CAN__BITRATE: str


async def update_list_of_comports(dpg, combobox):
    ports = list_ports.comports()
    dpg.configure_item(combobox, items=ports)


def make_node(settings: CyphalLocalNodeSettings):
    import pycyphal
    import pycyphal.application
    settings_dictionary = dataclasses.asdict(settings)
    new_settings_dictionary = {}
    for key, value in settings_dictionary.items():
        new_settings_dictionary[str(key).strip()] = str(value)
    settings_dictionary["UAVCAN__CAN__IFACE"] = settings_dictionary.get("UAVCAN__CAN__IFACE")
    registry = pycyphal.application.make_registry(environment_variables=new_settings_dictionary)
    # transport = pycyphal.application.make_transport(registers=registry, reconfigurable=True)
    from pycyphal.application import make_node
    from pycyphal.application import NodeInfo
    node = make_node(NodeInfo(name="com.zubax.sapog.tests.debugger"), registry)
    node.start()
    return node


def make_cyphal_window(dpg, logger, default_font, settings: CyphalLocalNodeSettings, theme,
                       use_alternative_labels=True):
    labels = {"mtu": "   UAVCAN__CAN__MTU", "iface": "  UAVCAN__CAN__IFACE", "nodeid": "   UAVCAN__NODE__ID"}
    if use_alternative_labels:
        labels = {"mtu": "   Maximum transmission unit", "iface": "  Interface", "nodeid": "   Node id"}
    with dpg.window(label="Cyphal settings", tag="Primary Window", width=400) as main_window_id:
        logger.warning(f"Main window id is {main_window_id}")
        dpg.bind_item_theme(main_window_id, theme)
        dpg.bind_font(default_font)
        dpg.add_text("Local node settings")
        input_field_width = 490
        dpg.add_input_text(label=labels["mtu"], default_value=str(settings.UAVCAN__CAN__MTU),
                           width=input_field_width)

        def combobox_callback(sender, app_data):
            settings.UAVCAN__CAN__IFACE = "slcan:" + str(app_data).split()[0]
            logger.warning(f"New UAVCAN__CAN__IFACE is {settings.UAVCAN__CAN__IFACE}")
            logger.warning("Something was selected")

        with dpg.theme() as combobox_theme:
            with dpg.theme_component(dpg.mvAll):
                # cool color, maybe later?
                # dpg.add_theme_color(dpg.mvThemeCol_FrameBg, (255, 140, 23), category=dpg.mvThemeCat_Core)
                dpg.add_theme_style(dpg.mvStyleVar_WindowPadding, 0, 15, category=dpg.mvThemeCat_Core)
                dpg.add_theme_style(dpg.mvStyleVar_ItemInnerSpacing, 10, 10, category=dpg.mvThemeCat_Core)
        combobox = dpg.add_combo(label=labels["iface"], default_value=settings.UAVCAN__CAN__IFACE,
                                 width=input_field_width, callback=combobox_callback)
        asyncio.run(update_list_of_comports(dpg, combobox))
        dpg.bind_item_theme(combobox, combobox_theme)
        dpg.add_input_text(label=labels["nodeid"], default_value=str(settings.UAVCAN__NODE__ID),
                           width=input_field_width)
        lbl_error = dpg.add_text("", tag="lblError")
        dpg.add_button(label="Save")

        def launch_node():
            if settings.UAVCAN__CAN__IFACE == "":
                dpg.configure_item(lbl_error, default_value="You haven't set the interface.")
                return
            make_node(settings)

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
