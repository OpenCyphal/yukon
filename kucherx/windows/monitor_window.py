from logging import Logger

from domain.UID import UID
from themes.main_window_theme import get_main_theme


def make_monitor_window(dpg, logger: Logger) -> UID:
    with dpg.texture_registry(show=False):
        dpg.add_dynamic_texture(
            width=600, height=600, tag="monitor_graph_texture_tag", default_value=[1 for i in range(0, 600 * 600 * 4)]
        )
    with dpg.window(label="Cyphal monitor", tag="MonitorWindow") as monitor_window_id:
        dpg.add_text("")
        dpg.add_text("Monitoring!")

        dpg.add_image("monitor_graph_texture_tag")

    return monitor_window_id
