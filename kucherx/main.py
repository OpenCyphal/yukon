import threading
from typing import Optional, Any

import dearpygui.dearpygui as dpg  # type: ignore
import os
import sys
import asyncio

# This is to get __init__.py to run
from __init__ import nonce  # type: ignore

from kucherx.domain.attach_transport_request import AttachTransportRequest

from kucherx.domain.queue_quit_object import QueueQuitObject
from kucherx.domain.viewport_info import ViewPortInfo
from kucherx.domain.window_style_state import WindowStyleState
from kucherx.services.threads.errors_thread import errors_thread
from kucherx.services.threads.cyphal_worker import cyphal_worker_thread
from kucherx.services.threads.graph_from_avatars import graph_from_avatars_thread
from kucherx.services.threads.image_from_graph import image_from_graph_thread
from kucherx.services.terminate_handler import make_terminate_handler
from kucherx.services.folder_recognition.common_folders import (
    get_resources_directory,
    get_root_directory,
)

import logging
import pytest
import unittest
from time import sleep

from kucherx.domain.kucherx_state import KucherXState
from kucherx.high_dpi_handler import make_process_dpi_aware, configure_font_and_scale
from sentry_setup import setup_sentry
from kucherx.services.get_screen_resolution import get_screen_resolution
from kucherx.themes.main_window_theme import get_main_theme
from kucherx.windows.errors import make_errors_window
from kucherx.windows.request_inferior_transport import make_request_inferior_transport_window
from kucherx.close_popup_viewport import display_close_popup_viewport
from kucherx.menubars.main_menubar import make_main_menubar
import sentry_sdk

from kucherx.windows.monitor import make_monitor_window

setup_sentry(sentry_sdk)
paths = sys.path

logger = logging.getLogger(__file__)
logger.setLevel("NOTSET")


def run_gui_app() -> None:
    make_process_dpi_aware(logger)
    dpg.create_context()

    vpi: ViewPortInfo = ViewPortInfo(
        title="KucherX",
        width=920,
        height=870,
        small_icon=str(get_resources_directory() / "icons/png/KucherX.png"),
        large_icon=str(get_resources_directory() / "icons/png/KucherX_256.ico"),
        resizable=True,
    )
    dpg.create_viewport(**vpi.__dict__, decorated=True, x_pos=500, y_pos=500)

    # dpg.configure_app(docking=True, docking_space=dock_space)
    wss: WindowStyleState = WindowStyleState(
        font=configure_font_and_scale(dpg, logger, get_resources_directory()), theme=get_main_theme(dpg)
    )
    state = KucherXState()

    def exit_handler(_arg1: Any, _arg2: Any) -> None:
        state.gui_running = False
        print("Registering an exit!")
        state.update_graph_from_avatar_queue.put(QueueQuitObject())
        state.update_image_from_graph.put(QueueQuitObject())
        state.errors_queue.put(QueueQuitObject())

    make_terminate_handler(exit_handler)
    display_error_callback = make_errors_window(dpg, state)
    # Creating 3 new threads
    cyphal_worker_thread = threading.Thread(target=cyphal_worker_thread, args=[state])
    cyphal_worker_thread.start()
    errors_thread = threading.Thread(target=errors_thread, args=[state, display_error_callback])
    errors_thread.start()
    avatars_to_graph_thread = threading.Thread(target=graph_from_avatars_thread, args=[state])
    avatars_to_graph_thread.start()
    graphs_to_images_thread = threading.Thread(target=image_from_graph_thread, args=[state])
    graphs_to_images_thread.start()

    logging.getLogger("pycyphal").setLevel(logging.CRITICAL)
    logging.getLogger("can").setLevel(logging.ERROR)
    logging.getLogger("asyncio").setLevel(logging.CRITICAL)

    screen_resolution = get_screen_resolution()
    monitor_window_id = make_monitor_window(dpg, logger)
    dpg.set_primary_window(monitor_window_id, True)

    def add_transport(request: AttachTransportRequest) -> None:
        state.queue_add_transports.put(request)

    def remove_transport(request: AttachTransportRequest) -> None:
        state.queue_detach_transports.put(request)

    def open_interface_menu() -> None:
        make_request_inferior_transport_window(
            dpg, state, logger, wss, notify_transport_added=add_transport, notify_transport_removed=remove_transport
        )

    make_main_menubar(dpg, wss.font, new_interface_callback=open_interface_menu)

    dpg.setup_dearpygui()
    dpg.show_viewport()
    dpg.maximize_viewport()

    def dont_save_callback() -> None:
        logger.info("I was asked not to save")

    def save_callback() -> None:
        # save_cyphal_local_node_settings(state.settings)
        logger.info("I was asked to save")

    # dpg.show_style_editor()
    # below replaces, start_dearpygui()
    while dpg.is_dearpygui_running() and state.gui_running:
        # ensure_window_is_in_viewport(main_window_id)
        dpg.render_dearpygui_frame()

    print("Exiting via the easy route")
    exit_handler(None, None)
    dpg.stop_dearpygui()

    dpg.destroy_context()
    if state.is_close_dialog_enabled:
        dpg.create_context()
        display_close_popup_viewport(
            dpg, get_resources_directory(), screen_resolution, save_callback, dont_save_callback
        )

        while dpg.is_dearpygui_running():
            dpg.render_dearpygui_frame()

        dpg.destroy_context()
    state.gui_running = False
    logger.info("Gui was set to not running")
    # cyphal_worker_thread.join()
    print("Node thread joined")


def get_stop_after_value() -> Optional[str]:
    return os.environ.get("STOP_AFTER")


def auto_exit_task() -> int:
    if get_stop_after_value():
        stop_after_value = int(get_stop_after_value())  # type: ignore
        if stop_after_value:
            sleep(stop_after_value)
            logging.info("Program should exit!")
            dpg.stop_dearpygui()
    return 0


async def main() -> int:
    if get_stop_after_value():
        auto_exit_thread = threading.Thread(target=auto_exit_task)
        auto_exit_thread.start()
    run_gui_app()
    if get_stop_after_value():
        auto_exit_thread.join()
    return 0


if __name__ == "__main__":
    asyncio.run(main())
    exit(0)


class MyTest(unittest.TestCase):
    @pytest.mark.timeout(0.1)
    def test_get_root_directory(self) -> None:
        root_dir = get_root_directory()
        logging.info(root_dir)
        assert root_dir
