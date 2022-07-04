import dataclasses
from dataclasses import dataclass
import json


@dataclass
class CyphalLocalNodeSettings:
    UAVCAN__CAN__MTU: int
    UAVCAN__CAN__IFACE: str
    UAVCAN__NODE__ID: int


def make_cyphal_window(dpg, logger, default_font, settings: CyphalLocalNodeSettings, theme):
    with dpg.window(label="Cyphal settings", tag="Primary Window", width=400) as main_window_id:
        logger.warning(f"Main window id is {main_window_id}")
        dpg.bind_item_theme(main_window_id, theme)
        dpg.bind_font(default_font)
        dpg.add_text("Local node settings")
        input_field_width = 430
        dpg.add_input_text(label="UAVCAN__CAN__MTU", default_value=str(settings.UAVCAN__CAN__MTU),
                           width=input_field_width)
        dpg.add_input_text(label="UAVCAN__CAN__IFACE", default_value=settings.UAVCAN__CAN__IFACE,
                           width=input_field_width)
        dpg.add_input_text(label="UAVCAN__NODE__ID", default_value=str(settings.UAVCAN__NODE__ID),
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
