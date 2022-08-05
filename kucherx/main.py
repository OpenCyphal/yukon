import threading
from queue import Queue
from typing import Optional, Any
import os
import sys
import asyncio
import logging
import unittest
from time import sleep

import sentry_sdk
import webview
from pycyphal.application import make_transport, make_registry

from domain.attach_transport_request import AttachTransportRequest
from domain.interface import Interface
from kucherx.domain.queue_quit_object import QueueQuitObject
from kucherx.domain.viewport_info import ViewPortInfo

from kucherx.services.terminate_handler import make_terminate_handler
from kucherx.services.folder_recognition.common_folders import (
    get_resources_directory,
    get_root_directory,
)

from kucherx.domain.god_state import GodState
from kucherx.high_dpi_handler import make_process_dpi_aware, configure_font_and_scale
from kucherx.sentry_setup import setup_sentry

setup_sentry(sentry_sdk)
paths = sys.path

logger = logging.getLogger(__file__)
logger.setLevel("NOTSET")


def start_threads(state: GodState) -> None:
    # Creating 3 new threads
    from kucherx.services.threads.cyphal_worker import cyphal_worker_thread

    cyphal_worker_thread = threading.Thread(target=cyphal_worker_thread, args=[state])
    cyphal_worker_thread.start()
    print("Cyphal worker was started")


from serial.tools import list_ports
import json

state: GodState = GodState()


class Api:
    def get_ports_list(self):
        return json.dumps(list(map(str, list_ports.comports())))

    def attach_transport(self, interface_string, arb_rate, data_rate, node_id, mtu):
        state.queues.messages.put("Initiated attach transport")
        interface = Interface()
        interface.rate_arb = int(arb_rate)
        interface.rate_data = int(data_rate)
        interface.mtu = int(mtu)
        interface.iface = "slcan:" + str(interface_string).split()[0]
        print('Opening port %s' % interface.iface)
        print('Arb rate %d' % int(interface.rate_arb))
        print('Data rate %d' % int(interface.rate_data))
        atr: AttachTransportRequest = AttachTransportRequest(0, interface, node_id)
        state.queues.attach_transport.put(atr)
        while True:
            if state.queues.attach_transport_response.empty():
                sleep(0.1)
            else:
                break
        return state.queues.attach_transport_response.get()

    def get_messages(self):
        messages_serialized = json.dumps(list(state.queues.messages.queue))
        state.queues.messages = Queue()
        return messages_serialized

    def get_avatars(self):
        return json.dumps([x.to_builtin() for x in list(state.avatar.avatars_by_node_id.values())])

    def toggleFullscreen(self):
        webview.windows[0].toggle_fullscreen()


def run_gui_app() -> None:
    global state
    make_process_dpi_aware(logger)

    vpi: ViewPortInfo = ViewPortInfo(
        title="KucherX",
        width=920,
        height=870,
        small_icon=str(get_resources_directory() / "icons/png/KucherX.png"),
        large_icon=str(get_resources_directory() / "icons/png/KucherX_256.ico"),
        resizable=True,
    )
    api = Api()
    webview.create_window('KucherX — monitor', 'html/index.html', js_api=api, min_size=(600, 450), text_select=True)
    # Creating 3 new threads
    start_threads(state)
    webview.start(gui="qt", debug=True)

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
