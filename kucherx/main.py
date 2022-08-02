import threading
from typing import Optional, Any
import os
import sys
import asyncio
import logging
import unittest
from time import sleep

import pytest
import dearpygui.dearpygui as dpg
import sentry_sdk

from kucherx.domain.attach_transport_request import AttachTransportRequest

from kucherx.domain.queue_quit_object import QueueQuitObject
from kucherx.domain.viewport_info import ViewPortInfo

from kucherx.services.threads.graph_from_avatars import graph_from_avatars_thread
from kucherx.services.terminate_handler import make_terminate_handler
from kucherx.services.folder_recognition.common_folders import (
    get_resources_directory,
    get_root_directory,
)

from kucherx.domain.god_state import GodState
from kucherx.high_dpi_handler import make_process_dpi_aware, configure_font_and_scale
from kucherx.sentry_setup import setup_sentry
from kucherx.themes.main_window_theme import get_main_theme
from kucherx.windows.message_log import make_errors_window
from kucherx.windows.request_inferior_transport import make_request_inferior_transport_window
from kucherx.save_viewport import display_save_viewport

from kucherx.windows.monitor import make_monitor_window

setup_sentry(sentry_sdk)
paths = sys.path

logger = logging.getLogger(__file__)
logger.setLevel("NOTSET")


def start_threads(state: GodState) -> None:
    # Creating 3 new threads
    from kucherx.services.threads.errors_thread import errors_thread
    from kucherx.services.threads.cyphal_worker import cyphal_worker_thread

    cyphal_worker_thread = threading.Thread(target=cyphal_worker_thread, args=[state])
    cyphal_worker_thread.start()
    errors_thread = threading.Thread(target=errors_thread, args=[state])
    errors_thread.start()
    avatars_to_graph_thread = threading.Thread(target=graph_from_avatars_thread, args=[state])
    avatars_to_graph_thread.start()


def pixel_conversion(_input: int) -> float:
    """Byte to int"""
    return _input / 255


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
    state = GodState()
    state.gui.default_font = configure_font_and_scale(dpg, logger, get_resources_directory())
    state.gui.theme = get_main_theme(dpg)

    def exit_handler(_arg1: Any, _arg2: Any) -> None:
        state.gui.gui_running = False
        print("Registering an exit!")
        state.queues.update_graph_from_avatar_queue.put(QueueQuitObject())
        state.queues.messages_queue.put(QueueQuitObject())

    # dpg.enable_docking(dock_space=False)
    make_terminate_handler(exit_handler)

    state.gui.dpg = dpg
    start_threads(state)

    logging.getLogger("pycyphal").setLevel(logging.INFO)
    logging.getLogger("can").setLevel(logging.ERROR)
    logging.getLogger("asyncio").setLevel(logging.CRITICAL)

    def open_interface_menu() -> None:
        make_request_inferior_transport_window(
            dpg, state, notify_transport_requested=add_transport, notify_transport_removal=remove_transport
        )

    monitor_uid = make_monitor_window(dpg, state, open_interface_menu)
    dpg.set_primary_window(monitor_uid, True)
    make_errors_window(dpg, state, monitor_uid)

    def add_transport(request: AttachTransportRequest) -> None:
        state.queues.queue_add_transports.put(request)

    def remove_transport(request: AttachTransportRequest) -> None:
        state.queues.queue_detach_transports.put(request)

    dpg.setup_dearpygui()
    dpg.show_viewport()
    dpg.maximize_viewport()

    # dpg.show_style_editor()
    # below replaces, start_dearpygui()
    while dpg.is_dearpygui_running() and state.gui.gui_running:
        # ensure_window_is_in_viewport(main_window_id)
        dpg.render_dearpygui_frame()

    print("Exiting via the easy route")
    exit_handler(None, None)
    dpg.stop_dearpygui()

    dpg.destroy_context()
    display_save_viewport(dpg, state)
    state.gui.gui_running = False
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
    sys.exit(0)


class MyTest(unittest.TestCase):
    @pytest.mark.timeout(0.1)
    def test_get_root_directory(self) -> None:
        root_dir = get_root_directory()
        logging.info(root_dir)
        assert root_dir
