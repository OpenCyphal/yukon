import logging
import typing
from logging import Logger

from kucherx.domain.kucherx_state import KucherXState
from kucherx.domain.UID import UID
from kucherx.themes.main_window_theme import get_main_theme

logger = logging.getLogger(__file__)
logger.setLevel("NOTSET")


def make_monitor_window(
    dpg: typing.Any, state: KucherXState, open_interface_menu: typing.Callable[[None], None]
) -> UID:
    dpg.bind_font(state.default_font)
    with dpg.texture_registry(show=False):
        dpg.add_dynamic_texture(
            width=600, height=600, tag="monitor_graph_texture_tag", default_value=[1 for i in range(0, 600 * 600 * 4)]
        )
    with dpg.window(label="Cyphal monitor", tag="MonitorWindow") as monitor_window_id:
        # dpg.add_text("")
        with dpg.table(
            header_row=False,
            resizable=True,
            policy=dpg.mvTable_SizingStretchProp,
            borders_outerH=True,
            borders_innerV=True,
            borders_innerH=True,
            borders_outerV=True,
        ) as state.main_screen_table_uid:
            dpg.add_table_column()
            dpg.add_table_column()
            with dpg.table_row() as first_row:
                with dpg.table_cell():
                    with dpg.group(horizontal=True):
                        dpg.add_text("Monitoring!")
                        dpg.add_button(label="Open an interface", callback=open_interface_menu)
                    dpg.add_image("monitor_graph_texture_tag")
                with dpg.table_cell() as state.second_row:
                    pass

    return monitor_window_id
