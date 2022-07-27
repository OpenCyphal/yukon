import logging
import typing
from pathlib import Path

from kucherx.domain.kucherx_state import KucherXState

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")


def display_close_popup_viewport(
    dpg: typing.Any,
    state: KucherXState,
    resources_directory: Path,
    screen_resolution: typing.Tuple,
    save_callback: typing.Optional[typing.Callable] = None,
    dont_save_callback: typing.Optional[typing.Callable] = None,
) -> None:
    # Calculations for centering the viewport for the popup
    needed_width = 730
    needed_center_x_position = int(screen_resolution[0] / 2 - needed_width / 2)
    needed_height = 300
    needed_center_y_position = int(screen_resolution[1] / 2 - needed_height / 2)
    dpg.create_viewport(
        title="KucherX is closing",
        width=needed_width,
        max_height=needed_height,
        height=needed_height,
        x_pos=needed_center_x_position,
        y_pos=needed_center_y_position,
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
        if save_callback is None:

            def save_callback() -> None:
                pass

        if dont_save_callback is None:

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
