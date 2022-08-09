import threading
import typing
from queue import Queue
from typing import Optional, Any
import os
import sys
import asyncio
import logging
from time import sleep
import json
import sentry_sdk
import webview
from serial.tools import list_ports

from kucherx.domain.attach_transport_request import AttachTransportRequest
from kucherx.domain.avatar import Avatar
from kucherx.domain.interface import Interface
from kucherx.domain.queue_quit_object import QueueQuitObject
from kucherx.services.enhanced_json_encoder import EnhancedJSONEncoder

from kucherx.services.terminate_handler import make_terminate_handler

from kucherx.domain.god_state import GodState
from kucherx.high_dpi_handler import make_process_dpi_aware
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


state: GodState = GodState()


class MessagesPublisher(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        state.queues.messages.put(record)


messages_publisher = MessagesPublisher()
messages_publisher.setLevel(logging.INFO)
logger.root.addHandler(messages_publisher)


class Api:
    last_avatars: typing.List[Avatar] = []

    def get_ports_list(self) -> str:
        return json.dumps(list(map(str, list_ports.comports())))

    def attach_transport(self, interface_string: str, arb_rate: str, data_rate: str, node_id: str, mtu: str) -> str:
        state.queues.messages.put("Initiated attach transport")
        interface = Interface()
        interface.rate_arb = int(arb_rate)
        interface.rate_data = int(data_rate)
        interface.mtu = int(mtu)
        interface.iface = interface_string
        state.queues.messages.put(f"Opening port {interface.iface}")
        state.queues.messages.put(f"Arb rate {interface.rate_arb}")
        state.queues.messages.put(f"Data rate {interface.rate_data}")
        atr: AttachTransportRequest = AttachTransportRequest(0, interface, node_id)
        state.queues.attach_transport.put(atr)
        while True:
            if state.queues.attach_transport_response.empty():
                sleep(0.1)
            else:
                break
        return json.dumps(state.queues.attach_transport_response.get(), cls=EnhancedJSONEncoder)

    def get_messages(self) -> str:
        messages_serialized = json.dumps(list(state.queues.messages.queue))
        state.queues.messages = Queue()
        return messages_serialized

    def get_avatars(self) -> str:
        return json.dumps([x.to_builtin() for x in list(state.avatar.avatars_by_node_id.values())])

    def toggleFullscreen(self) -> None:
        webview.windows[0].toggle_fullscreen()


def run_gui_app() -> None:
    make_process_dpi_aware(logger)

    api = Api()
    webview.create_window(
        "KucherX — monitor", "html/monitor/monitor.html", js_api=api, min_size=(600, 450), text_select=True
    )
    webview.create_window(
        "KucherX — add transport",
        "html/add_transport/add_transport.html",
        js_api=api,
        width=350,
        height=500,
        text_select=True,
    )
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
