import copy
import threading
from queue import Queue, Empty
from threading import Thread
from typing import Union, Optional, Any, Dict

import can
import dearpygui.dearpygui as dpg  # type: ignore
import os
import sys
import asyncio

import networkx as nx
import serial

sys.path += ["."]
# This is to get __init__.py to run
from kucherx import nonce  # type: ignore

from networkx import DiGraph
from pycyphal.application import make_node, NodeInfo
from pycyphal.transport import InvalidMediaConfigurationError
from pycyphal.transport.can import CANTransport
from pycyphal.transport.can.media.pythoncan import PythonCANMedia

from domain.avatar import Avatar
from domain.interface import Interface
from domain.note_state import NodeState
from domain.viewport_info import ViewPortInfo
from domain.window_style_state import WindowStyleState
from services.terminate_handler import make_terminate_handler
from services.folder_recognition.get_common_folders import (
    get_resources_directory,
    get_root_directory,
    get_sources_directory,
    get_kucherx_directory,
)

import logging
import pytest
import unittest
from time import sleep, time

from domain.kucherx_state import KucherXState
from high_dpi_handler import make_process_dpi_aware, is_high_dpi_screen, configure_font_and_scale
from sentry_setup import setup_sentry
from services.get_screen_resolution import get_screen_resolution
from services.make_node_debugger import make_node_debugger
from themes.main_window_theme import get_main_theme
from windows.add_interface_window import make_add_interface_window
from windows.close_popup_viewport import display_close_popup_viewport
from menubars.main_menubar import make_main_menubar
import sentry_sdk


from windows.monitor_window import make_monitor_window

import matplotlib.pyplot as plt
from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas

setup_sentry(sentry_sdk)
paths = sys.path

logger = logging.getLogger(__file__)
logger.setLevel("NOTSET")

class QueueQuitObject:
    pass

def _cyphal_worker_thread(state: KucherXState, queue: Queue) -> None:
    """It starts the node and keeps adding any transports that are queued for adding"""

    async def _internal_method():
        state.local_node = make_node(NodeInfo(name="com.zubax.sapog.tests.debugger"), reconfigurable_transport=True)
        state.local_node.start()
        state.pseudo_transport = state.local_node.presentation.transport
        make_node_debugger(state)
        while state.gui_running:
            try:
                await asyncio.sleep(0.05)
                interface = queue.get_nowait()
                new_media = PythonCANMedia(interface.iface, (interface.rate_arb, interface.rate_data), interface.mtu)
                new_transport = CANTransport(media=new_media, local_node_id=state.local_node.id)
                state.pseudo_transport.attach_inferior(new_transport)
                print("Added a new interface")
            except Empty:
                pass
            except (
                PermissionError,
                can.exceptions.CanInitializationError,
                InvalidMediaConfigurationError,
                can.exceptions.CanOperationError,
                serial.serialutil.SerialException,
            ) as e:
                logger.error(e)

    asyncio.run(_internal_method())


def _graph_from_avatars_thread(state: KucherXState) -> None:
    while state.gui_running:
        new_avatar = state.update_graph_from_avatar_queue.get()
        if isinstance(new_avatar, QueueQuitObject):
            break
        else:
            print("This is not a queue quit object")
        state.avatars_lock.acquire()
        avatars_copy: Dict[int, Avatar] = copy.copy(state.avatars)
        state.avatars_lock.release()
        state.current_graph = DiGraph()
        for node_id_publishing, avatar_publishing in avatars_copy.items():
            node_state: NodeState = avatar_publishing.update(time())
            for subject_id in node_state.ports.pub:
                state.current_graph.add_edge(node_id_publishing, subject_id)
                for node_id_subscribing, avatar2_subscribing in avatars_copy.items():
                    subscribing_node_state = avatar2_subscribing.update(time())
                    if subject_id in subscribing_node_state.ports.sub:
                        state.current_graph.add_edge(subject_id, node_id_subscribing)
        state.update_image_from_graph.put(copy.copy(state.current_graph))


def _get_current_monitor_image_size():
    return 600


def bti(byte):
    """Byte to int"""
    return byte / 255


def _image_from_graph_thread(state: KucherXState) -> None:
    while state.gui_running:
        G = state.update_image_from_graph.get()
        if isinstance(G, QueueQuitObject):
            break
        else:
            print("This is not a queue quit object")
        image_size = _get_current_monitor_image_size()
        px = 1 / plt.rcParams["figure.dpi"]  # pixel in inches
        plt.rcParams["backend"] = "TkAgg"
        figure = plt.figure(figsize=(image_size * px, image_size * px))
        canvas = FigureCanvas(figure)
        pos = nx.spring_layout(G)
        nx.draw(G, pos=pos, with_labels=True, node_shape="p", node_size=2600)
        # https://stackoverflow.com/questions/47094949/labeling-edges-in-networkx
        edge_labels = dict([((n1, n2), f"{n1}->{n2}") for n1, n2 in G.edges])
        nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels)
        canvas.draw()
        new_texture_data2 = canvas.tostring_rgb()
        plt.show()
        new_texture_data = []
        for i in range(0, image_size * image_size * 3, 3):
            new_texture_data.append(bti(new_texture_data2[i]))
            new_texture_data.append(bti(new_texture_data2[i + 1]))
            new_texture_data.append(bti(new_texture_data2[i + 2]))
            new_texture_data.append(1)
        dpg.set_value("monitor_graph_texture_tag", new_texture_data)


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

    make_terminate_handler(exit_handler)

    queue_add_interfaces: Queue = Queue()
    cyphal_worker_thread = threading.Thread(target=_cyphal_worker_thread, args=(state, queue_add_interfaces))
    cyphal_worker_thread.start()
    avatars_to_graph_thread = threading.Thread(target=_graph_from_avatars_thread, args=[state])
    avatars_to_graph_thread.start()
    graphs_to_images_thread = threading.Thread(target=_image_from_graph_thread, args=[state])
    graphs_to_images_thread.start()
    logging.getLogger("pycyphal").setLevel(logging.CRITICAL)
    logging.getLogger("can").setLevel(logging.ERROR)
    logging.getLogger("asyncio").setLevel(logging.CRITICAL)
    screen_resolution = get_screen_resolution()
    monitor_window_id = make_monitor_window(dpg, logger)
    dpg.set_primary_window(monitor_window_id, True)

    def add_interface(interface: Interface) -> None:
        queue_add_interfaces.put(interface)

    def open_interface_menu() -> None:
        make_add_interface_window(dpg, state, logger, wss, interface_added_callback=add_interface)

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
            dpg, logger, get_resources_directory(), screen_resolution, save_callback, dont_save_callback
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
    def test_get_root_directory(self):
        root_dir = get_root_directory()
        logging.info(root_dir)
        assert root_dir
