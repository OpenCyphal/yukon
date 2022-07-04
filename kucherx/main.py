from typing import Union

import dearpygui.dearpygui as dpg  # type: ignore
import os
import asyncio
import time
import pathlib
import ctypes
import logging
import pytest
import unittest

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


def print_me(sender):
    print(f"Menu Item: {sender}")


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


def make_process_dpi_aware():
    try:
        result = ctypes.windll.shcore.SetProcessDpiAwareness(2)  # if your windows version >= 8.1
    except:
        result = ctypes.windll.user32.SetProcessDPIAware()  # win 8.0 or less
    # https://docs.microsoft.com/en-us/windows/win32/api/shellscalingapi/nf-shellscalingapi-setprocessdpiawareness
    match result:
        case None:
            logger.warning("DPI awareness did not have a return value")
        case 0:
            logger.warning("DPI awareness set successfully")
        case 1:
            logger.warning("The value passed in for DPI awareness is not valid.")
        case 2:
            logger.warning("E_ACCESSDENIED. The DPI awareness is already set, either by calling this API previously"
                           " or through the application (.exe) manifest. ")


def is_high_dpi_screen():
    make_process_dpi_aware()
    try:
        import tkinter
        root = tkinter.Tk()
        dpi = root.winfo_fpixels('1i')
        logger.warning("DPI is " + str(dpi) + " on screen " + root.winfo_screen())
        return dpi > 100
    except ImportError as e:
        logger.warn("Unable to import TKinter, it is missing from Python. Can't tell if the screen is high dpi.")
        return False


def run_gui_app():
    make_process_dpi_aware()
    prepare_rendered_icons()
    dpg.create_context()
    dpg.create_viewport(title='KucherX', width=1600, height=900,
                        small_icon=str(get_resources_directory() / "icons/png/KucherX.png"),
                        large_icon=str(get_resources_directory() / "icons/png/KucherX_256.ico"))
    desired_font_size = 20

    if is_high_dpi_screen():
        dpg.set_global_font_scale(0.8)
        desired_font_size = 40

    # add a font registry
    with dpg.font_registry():
        # first argument ids the path to the .ttf or .otf file
        default_font = dpg.add_font(file=get_resources_directory() / "Roboto/Roboto-Regular.ttf",
                                    size=desired_font_size)

    def mouse_down(sender, app_data):
        logger.warning(f"Mouse Button: {app_data[0]}, Down Time: {app_data[1]} seconds")

    with dpg.handler_registry():
        dpg.add_mouse_down_handler(callback=mouse_down)

    dpg.show_item_registry()  # This is for debugging so I can see some things

    # no_move is used because I will implement movement myself.
    with dpg.window(label="Example Window", tag="Primary Window", no_move=True) as main_window_id:
        logger.warning(f"Main window id is {main_window_id}")
        dpg.bind_font(default_font)
        dpg.add_text("Hello, world")
        dpg.add_button(label="Save")
        dpg.add_input_text(label="string", default_value="Quick brown fox")
        dpg.add_slider_float(label="float", default_value=0.273, max_value=1)

    with dpg.viewport_menu_bar():
        dpg.bind_font(default_font)
        with dpg.menu(label="File"):
            dpg.add_menu_item(label="Save", callback=print_me)
            dpg.add_menu_item(label="Save As", callback=print_me)

            with dpg.menu(label="Settings"):
                dpg.add_menu_item(label="Setting 1", callback=print_me, check=True)
                dpg.add_menu_item(label="Setting 2", callback=print_me)

        dpg.add_menu_item(label="Help", callback=print_me)

        with dpg.menu(label="Widget Items"):
            dpg.add_checkbox(label="Pick Me", callback=print_me)
            dpg.add_button(label="Press Me", callback=print_me)
            dpg.add_color_picker(label="Color Me", callback=print_me)

    dpg.setup_dearpygui()
    # Include the following code before showing the viewport/calling `dearpygui.dearpygui.show_viewport`.

    dpg.show_viewport()
    # below replaces, start_dearpygui()
    while dpg.is_dearpygui_running():
        ensure_window_is_in_viewport(main_window_id)

        dpg.render_dearpygui_frame()
    dpg.destroy_context()


def auto_exit_task():
    if os.environ.get("STOP_AFTER"):
        stop_after_value = int(os.environ.get("STOP_AFTER"))
        if stop_after_value:
            time.sleep(stop_after_value)
            logging.info("Program should exit!")
            dpg.stop_dearpygui()
    return 0


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
