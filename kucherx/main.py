import threading
from typing import Optional, Any
import os
import sys
import asyncio
import logging
import unittest
from time import sleep

import pytest
import sentry_sdk
import webview
from pycyphal.application import make_transport, make_registry

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
from kucherx.services.render_graph import render_graph
from kucherx.windows.allocations import make_allocations_window
from services.make_tracers_trackers import make_tracers_trackers

setup_sentry(sentry_sdk)
paths = sys.path

logger = logging.getLogger(__file__)
logger.setLevel("NOTSET")


def start_threads(state: GodState) -> None:
    # Creating 3 new threads
    from kucherx.services.threads.messages_thread import messages_thread
    from kucherx.services.threads.cyphal_worker import cyphal_worker_thread

    cyphal_worker_thread = threading.Thread(target=cyphal_worker_thread, args=[state])
    cyphal_worker_thread.start()
    errors_thread = threading.Thread(target=messages_thread, args=[state])
    errors_thread.start()
    avatars_to_graph_thread = threading.Thread(target=graph_from_avatars_thread, args=[state])
    avatars_to_graph_thread.start()


def prepare_everything_cyphal_related(state: GodState):
    state.cyphal.local_node.start()
    state.cyphal.pseudo_transport = state.cyphal.local_node.presentation.transport
    make_tracers_trackers(state)
    registry = make_registry()
    registry["uavcan.can.iface"] = "slcan:/"
    registry["uavcan.can.mtu"] = "8"
    registry["uavcan.can.bitrate"] = [self.requested_interface.rate_arb, self.requested_interface.rate_data]
    registry["uavcan.can.node_id"] = self.local_node_id
    new_transport = make_transport()
    state.gui.transports_of_windows[atr.requesting_window_id] = new_transport
    state.cyphal.pseudo_transport.attach_inferior(new_transport)
    state.queues.transport_successfully_added_messages.put(atr.requested_interface.iface)


from serial.tools import list_ports
import json

class Api():
    def get_ports_list(self):
        return json.dumps(list(map(str, list_ports.comports())))

    def addItem(self, title):
        print('Added item %s' % title)

    def removeItem(self, item):
        print('Removed item %s' % item)

    def editItem(self, item):
        print('Edited item %s' % item)

    def toggleItem(self, item):
        print('Toggled item %s' % item)

    def toggleFullscreen(self):
        webview.windows[0].toggle_fullscreen()


def run_gui_app() -> None:
    make_process_dpi_aware(logger)

    vpi: ViewPortInfo = ViewPortInfo(
        title="KucherX",
        width=920,
        height=870,
        small_icon=str(get_resources_directory() / "icons/png/KucherX.png"),
        large_icon=str(get_resources_directory() / "icons/png/KucherX_256.ico"),
        resizable=True,
    )
    state = GodState()
    api = Api()
    webview.create_window('KucherX', 'html/index.html', js_api=api, min_size=(600, 450))
    webview.start()

    def exit_handler(_arg1: Any, _arg2: Any) -> None:
        state.gui.gui_running = False
        print("Registering an exit!")
        state.queues.graph_from_avatar.put(QueueQuitObject())
        state.queues.messages.put(QueueQuitObject())

    # dpg.enable_docking(dock_space=False)
    make_terminate_handler(exit_handler)

    start_threads(state)

    logging.getLogger("pycyphal").setLevel(logging.INFO)
    logging.getLogger("can").setLevel(logging.INFO)
    logging.getLogger("asyncio").setLevel(logging.CRITICAL)

    exit_handler(None, None)
    state.gui.gui_running = False


def get_stop_after_value() -> Optional[str]:
    return os.environ.get("STOP_AFTER")


def auto_exit_task() -> int:
    if get_stop_after_value():
        stop_after_value = int(get_stop_after_value())  # type: ignore
        if stop_after_value:
            sleep(stop_after_value)
            logging.info("Program should exit!")
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
