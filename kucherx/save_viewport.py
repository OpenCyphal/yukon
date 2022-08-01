import logging
import typing
from dataclasses import dataclass
from pathlib import Path

from kucherx.domain.god_state import GodState
from services.folder_recognition.common_folders import get_resources_directory
from services.get_screen_resolution import get_screen_resolution

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")


@dataclass
class _ViewportParams:
    width_px: int
    height_px: int
    center_x_px: int
    center_y_px: int


def get_needed_vieport_params() -> _ViewportParams:
    screen_resolution = get_screen_resolution()
    needed_width = 730
    needed_height = 300
    needed_center_x_position = int(screen_resolution[0] / 2 - needed_width / 2)
    needed_center_y_position = int(screen_resolution[1] / 2 - needed_height / 2)
    new_params: _ViewportParams = _ViewportParams(needed_width, needed_height, needed_center_x_position,
                                                needed_center_y_position)
    return new_params


def display_save_viewport(
        dpg: typing.Any,
        state: GodState,
) -> None:
    if state.is_close_dialog_enabled:
        dpg.create_context()
    # Calculations for centering the viewport for the popup
    resources_directory = get_resources_directory()
    vpp: _ViewportParams = get_needed_vieport_params()
    dpg.create_viewport(
        title="KucherX is closing",
        width=vpp.width_px,
        max_height=vpp.height_px,
        height=vpp.height_px,
        x_pos=vpp.center_x_px,
        y_pos=vpp.center_y_px,
        small_icon=str(resources_directory / "icons/png/KucherX.png"),
        large_icon=str(resources_directory / "icons/png/KucherX_256.ico"),
        resizable=False,
    )
    dpg.setup_dearpygui()
    # Include the following code before showing the viewport/calling `dearpygui.dearpygui.show_viewport`.

    dpg.show_viewport()
    with dpg.window(label="Before you exit") as primary_window:
        dpg.bind_font(state.default_font)
        dpg.add_text("Do you want to save your Cyphal local node settings?")

        def save_callback() -> None:
            pass

        def dont_save_callback() -> None:
            pass

        def close_callback() -> None:
            dpg.stop_dearpygui()

        btn_save = dpg.add_button(label="Save", width=200)
        btn_dont_save = dpg.add_button(label="Don't save", width=200)
        dpg.set_item_callback(btn_dont_save, dont_save_callback)
        dpg.set_item_callback(btn_save, save_callback)

        dpg.set_item_callback(btn_save, close_callback)
        dpg.set_item_callback(btn_dont_save, close_callback)
    dpg.set_primary_window(primary_window, True)
    dpg.start_dearpygui()
