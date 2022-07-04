from typing import Union

import dearpygui.dearpygui as dpg  # type: ignore
import os
import asyncio
import time
import pathlib

import logging
import pytest
import unittest

from high_dpi_handler import make_process_dpi_aware, is_high_dpi_screen, configure_font_and_scale
from windows.cyphal_window import make_cyphal_window, CyphalLocalNodeSettings
from windows.close_popup_viewport import display_close_popup_viewport
from menubars.main_menubar import make_main_menubar
import sentry_sdk

# sentry_sdk.init(
#     dsn="https://b594be40049042b0bacfc6a9e0cbfa7e@o86093.ingest.sentry.io/6547831",
#
#     # Set traces_sample_rate to 1.0 to capture 100%
#     # of transactions for performance monitoring.
#     # We recommend adjusting this value in production.
#     traces_sample_rate=1.0
# )

logger = logging.getLogger(__file__)


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


def get_kucherx_directory():
    return get_root_directory() / "kucherx"


def get_sources_directory():
    return pathlib.Path(__file__).parent.resolve()


def get_resources_directory():
    return get_kucherx_directory() / "res"


ID = Union[str, int]


def ensure_window_is_in_viewport(window_id: ID):
    window_x_pos = dpg.get_item_pos(window_id)[0]
    window_y_pos = dpg.get_item_pos(window_id)[1]
    if window_x_pos < 0:
        # dpg.configure_item(window_id, no_move=True)
        dpg.set_item_pos(window_id, [0, window_y_pos])


def prepare_rendered_icons():
    from os import walk
    try:
        import cairosvg
        svg_files = []
        for (dir_path, dir_names, filenames) in walk(get_resources_directory() / "icons" / "svg"):
            for file_name in filenames:
                if ".svg" in file_name:
                    svg_files.append(file_name)
            break
    except Exception as e:
        if type(e) == OSError and "no library called \"cairo-2\" was found" in repr(e):
            logger.error("Was unable to find the cairo-2 dlls. This means that I am unable to convert SVG icons to "
                         "PNG for display.")
            return
        else:
            raise e


def run_gui_app():
    make_process_dpi_aware(logger)
    prepare_rendered_icons()
    dpg.create_context()
    dpg.create_viewport(title='KucherX', width=1600, height=900,
                        small_icon=str(get_resources_directory() / "icons/png/KucherX.png"),
                        large_icon=str(get_resources_directory() / "icons/png/KucherX_256.ico"))
    default_font = configure_font_and_scale(dpg, logger, get_resources_directory())

    # dpg.configure_app(docking=True, docking_space=dock_space)

    settings = CyphalLocalNodeSettings(8, "COM10", 127)
    main_window_id = make_cyphal_window(dpg, logger, default_font, settings)
    make_main_menubar(dpg, default_font)
    dpg.setup_dearpygui()
    # Include the following code before showing the viewport/calling `dearpygui.dearpygui.show_viewport`.

    dpg.show_viewport()
    # below replaces, start_dearpygui()
    while dpg.is_dearpygui_running():
        ensure_window_is_in_viewport(main_window_id)
        dpg.render_dearpygui_frame()
    dpg.destroy_context()
    display_close_popup_viewport(dpg, logger, get_resources_directory())


def auto_exit_task():
    if os.environ.get("STOP_AFTER"):
        stop_after_value = int(os.environ.get("STOP_AFTER"))
        if stop_after_value:
            time.sleep(stop_after_value)
            logging.info("Program should exit!")
            dpg.stop_dearpygui()
    return 0


def scan_for_com_ports_task():
    pass


async def main():
    await asyncio.gather(
        asyncio.to_thread(run_gui_app),
        asyncio.to_thread(auto_exit_task)
    )


if __name__ == "__main__":
    asyncio.run(main())


class MyTest(unittest.TestCase):
    @pytest.mark.timeout(0.1)
    def test_get_root_directory(self):
        root_dir = get_root_directory()
        logging.info(root_dir)
        assert root_dir
