import threading
from queue import Queue, Empty
from threading import Thread
from typing import Union, Optional

import dearpygui.dearpygui as dpg  # type: ignore
import os
import sys
import asyncio

from pycyphal.application import make_node, NodeInfo
from pycyphal.transport.can import CANTransport
from pycyphal.transport.can.media.pythoncan import PythonCANMedia

from domain.Interface import Interface
from domain.UID import UID
from domain.ViewPortInfo import ViewPortInfo
from domain.WindowStyleState import WindowStyleState
from services.InterfaceService import interface_added
from services.TerminateHandler import make_terminate_handler
from services.folder_recognition.get_common_folders import *

import logging
import pytest
import unittest

from domain.KucherXState import KucherXState
from high_dpi_handler import make_process_dpi_aware, is_high_dpi_screen, configure_font_and_scale
from sentry_setup import setup_sentry
from services.make_node_debugger import make_node_debugger
from services.render_icons import prepare_rendered_icons
from themes.main_window_theme import get_main_theme
from windows.add_interface_window import make_add_interface_window
from windows.close_popup_viewport import display_close_popup_viewport
from menubars.main_menubar import make_main_menubar
import sentry_sdk
# This is to get __init__.py to run
from kucherx import nonce  # type: ignore
from windows.monitor_window import make_monitor_window

setup_sentry(sentry_sdk)
paths = sys.path

logger = logging.getLogger(__file__)
logger.setLevel("NOTSET")


def get_screen_resolution():
    """If the screen size is known then the close dialog can be centered via its position"""
    if os.name == "nt":
        import ctypes
        user32 = ctypes.windll.user32
        return user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)
    else:
        logger.warning("Screen resolution detection is not yet implemented for non-windows platforms.")
        return 1280, 720


def _adding_interfaces_thread(state, queue):
    """It also starts the node"""
    asyncio.set_event_loop(asyncio.new_event_loop())
    state.local_node = make_node(NodeInfo(name="com.zubax.sapog.tests.debugger"), reconfigurable_transport=True)
    state.local_node.start()
    make_node_debugger(state)
    state.pseudo_transport = state.local_node.presentation.transport
    while state.gui_running:
        try:
            interface = queue.get(timeout=0.05)
            new_media = PythonCANMedia(interface.iface, (interface.rate_arb, interface.rate_data), interface.mtu)
            new_transport = CANTransport(media=new_media, local_node_id=state.local_node.id)
            state.pseudo_transport.attach_inferior(new_transport)
        except Empty:
            pass


async def run_gui_app():
    make_process_dpi_aware(logger)
    prepare_rendered_icons(logger)
    dpg.create_context()

    vpi: ViewPortInfo = ViewPortInfo(title='KucherX', width=920, height=870,
                                     small_icon=str(get_resources_directory() / "icons/png/KucherX.png"),
                                     large_icon=str(get_resources_directory() / "icons/png/KucherX_256.ico"),
                                     resizable=False)
    dpg.create_viewport(**vpi.__dict__, decorated=True)

    # dpg.configure_app(docking=True, docking_space=dock_space)
    wss: WindowStyleState = WindowStyleState(font=configure_font_and_scale(dpg, logger, get_resources_directory()),
                                             theme=get_main_theme(dpg))
    state = KucherXState()

    def exit_handler(arg1, arg2):
        state.gui_running = False

    make_terminate_handler(exit_handler)

    queue_add_interfaces: Queue = Queue()
    node_thread = threading.Thread(target=_adding_interfaces_thread, args=(state, queue_add_interfaces))
    node_thread.start()
    logging.getLogger('pycyphal').setLevel(logging.CRITICAL)
    logging.getLogger('asyncio').setLevel(logging.CRITICAL)
    screen_resolution = get_screen_resolution()
    monitor_window_id = make_monitor_window(dpg, logger)
    dpg.set_primary_window(monitor_window_id, True)

    def add_interface(interface: Interface):
        queue_add_interfaces.put(interface)

    def open_interface_menu():
        make_add_interface_window(dpg, state, logger, wss, interface_added_callback=add_interface)

    make_main_menubar(dpg, wss.font, new_interface_callback=open_interface_menu)
    dpg.setup_dearpygui()
    dpg.show_viewport()
    dpg.maximize_viewport()

    def dont_save_callback():
        logger.info("I was asked not to save")

    def save_callback():
        # save_cyphal_local_node_settings(state.settings)
        logger.info("I was asked to save")

    # dpg.show_style_editor()
    # below replaces, start_dearpygui()
    while dpg.is_dearpygui_running() and state.gui_running:
        # ensure_window_is_in_viewport(main_window_id)
        dpg.render_dearpygui_frame()

    dpg.stop_dearpygui()

    dpg.destroy_context()
    if state.is_close_dialog_enabled:
        dpg.create_context()
        display_close_popup_viewport(dpg, logger, get_resources_directory(), screen_resolution, save_callback,
                                     dont_save_callback)

        while dpg.is_dearpygui_running():
            dpg.render_dearpygui_frame()

        dpg.destroy_context()
    state.gui_running = False
    logger.info("Gui was set to not running")
    node_thread.join()
    print("Node thread joined")


def get_stop_after_value():
    return os.environ.get("STOP_AFTER")


def auto_exit_task():
    if get_stop_after_value():
        stop_after_value = int(get_stop_after_value())
        if stop_after_value:
            time.sleep(stop_after_value)
            logging.info("Program should exit!")
            dpg.stop_dearpygui()
    return 0


def scan_for_com_ports_task():
    pass


async def main():
    if get_stop_after_value():
        auto_exit_thread = threading.Thread(target=auto_exit_task)
        auto_exit_thread.start()
    await run_gui_app()
    if get_stop_after_value():
        auto_exit_thread.join()
    return 0


if __name__ == "__main__":
    asyncio.run(main())
    exit(0)


class MyTest(unittest.TestCase):
    @pytest.mark.timeout(0.1)
    def test_get_root_directory(self):
        root_dir = get_root_directory()
        logging.info(root_dir)
        assert root_dir
