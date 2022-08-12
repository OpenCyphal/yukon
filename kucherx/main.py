import copy
import threading
import typing
from queue import Empty
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
from webview.window import Window

import uavcan
from kucherx.domain.attach_transport_request import AttachTransportRequest
from kucherx.domain.avatar import Avatar
from kucherx.domain.interface import Interface
from kucherx.domain.queue_quit_object import QueueQuitObject
from kucherx.domain.update_register_request import UpdateRegisterRequest
from kucherx.services.enhanced_json_encoder import EnhancedJSONEncoder
from kucherx.services.messages_publisher import MessagesPublisher

from kucherx.services.terminate_handler import make_terminate_handler

from kucherx.domain.god_state import GodState
from kucherx.high_dpi_handler import make_process_dpi_aware
from kucherx.sentry_setup import setup_sentry
from kucherx.services.value_utils import unexplode_value

setup_sentry(sentry_sdk)
paths = sys.path

logger = logging.getLogger()
logger.setLevel("INFO")


def start_threads(_state: GodState) -> None:
    # Creating 3 new threads
    from kucherx.services.cyphal_worker import cyphal_worker_thread

    cyphal_worker_thread = threading.Thread(target=cyphal_worker_thread, args=[_state])
    cyphal_worker_thread.start()
    print("Cyphal worker was started")


state: GodState = GodState()

messages_publisher = MessagesPublisher(state)
messages_publisher.setLevel(logging.NOTSET)
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
messages_publisher.setFormatter(formatter)
logger.addHandler(messages_publisher)

monitor_window: Optional[Window]
add_transport_window: Optional[Window]


class Api:
    last_avatars: typing.List[Avatar] = []

    def get_ports_list(self) -> str:
        return json.dumps(list(map(str, list_ports.comports())))

    def add_local_message(self, message: str) -> None:
        logger.info(message)

    def open_file_dialog(self) -> None:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()

        file_path = filedialog.askopenfilename(filetypes=[("Candump files", ".candump .txt .json")])
        _ = file_path

    def update_register_value(self, register_name: str, register_value: str, node_id: int) -> None:
        # Find the avatar which has the node_id
        for avatar in state.avatar.avatars_by_node_id.values():
            if avatar.node_id == node_id:
                exploded_value = avatar.register_exploded_values[register_name]
                break
        new_exploded_value = copy.copy(exploded_value)
        # Check if register_value can be converted to an int, is purely numeric
        if register_value.isnumeric():
            new_exploded_value[list(new_exploded_value.keys())[0]]["value"] = int(register_value)
        else:
            new_exploded_value[list(new_exploded_value.keys())[0]]["value"] = register_value
        new_value: uavcan.register.Value_1 = unexplode_value(new_exploded_value)
        state.queues.update_registers.put(UpdateRegisterRequest(register_name, new_value, node_id))

    def attach_transport(self, interface_string: str, arb_rate: str, data_rate: str, node_id: str, mtu: str) -> str:
        state.queues.messages.put("Initiated attach transport")
        interface = Interface()
        interface.rate_arb = int(arb_rate)
        interface.rate_data = int(data_rate)
        interface.mtu = int(mtu)
        interface.iface = interface_string
        logger.info(f"Opening port {interface.iface}")  # pylint: disable=logging-fstring-interpolation
        logger.info(f"Arb rate {interface.rate_arb}")  # pylint: disable=logging-fstring-interpolation
        logger.info(f"Data rate {interface.rate_data}")  # pylint: disable=logging-fstring-interpolation

        atr: AttachTransportRequest = AttachTransportRequest(interface, int(node_id))
        state.queues.attach_transport.put(atr)
        while True:
            if state.queues.attach_transport_response.empty():
                sleep(0.1)
            else:
                break
        return json.dumps(state.queues.attach_transport_response.get(), cls=EnhancedJSONEncoder)

    def show_yakut(self) -> None:
        state.avatar.hide_yakut_avatar = False

    def hide_yakut(self) -> None:
        state.avatar.hide_yakut_avatar = True

    def get_messages(self) -> str:
        messages_serialized = json.dumps(list(state.queues.messages.queue))
        # Emptying all messages from the queue
        while not state.queues.messages.empty():
            try:
                state.queues.messages.get(False)
            except Empty:
                continue

        # state.queues.messages = Queue()
        return messages_serialized

    def get_avatars(self) -> str:
        avatar_list = [avatar.to_builtin() for avatar in list(state.avatar.avatars_by_node_id.values())]
        avatar_dto = {"avatars": avatar_list, "hash": hash(json.dumps(avatar_list, sort_keys=True))}
        if state.avatar.hide_yakut_avatar:
            for avatar in avatar_list:
                amount_of_subscriptions = len(avatar["ports"]["sub"])
                if avatar["name"] and avatar["name"] == "yakut":
                    avatar_list.remove(avatar)
                elif amount_of_subscriptions == 8192:  # only yakut subscribes to every port number
                    avatar_list.remove(avatar)
        return json.dumps(avatar_dto)

    def toggleFullscreen(self) -> None:
        webview.windows[0].toggle_fullscreen()

    def hide_transport_window(self) -> None:
        if add_transport_window is not None:
            add_transport_window.hide()

    def open_monitor_window(self):
        assert state.api
        print("opening monitor window")
        monitor_window = webview.create_window(
            "KucherX — monitor", "html/monitor/monitor.html", js_api=state.api, min_size=(600, 450), text_select=True,
        )

state.api = Api()
def run_gui_app() -> None:
    global monitor_window, add_transport_window  # pylint: disable: global-statement
    make_process_dpi_aware(logger)

    add_transport_window = webview.create_window(
        "KucherX — add transport",
        "html/add_transport/add_transport.html",
        js_api=state.api,
        width=600,
        height=520,
        text_select=True,
    )
    # Creating 3 new threads
    start_threads(state)
    webview.start(gui="qt", debug=True)

    def exit_handler(_arg1: Any, _arg2: Any) -> None:
        state.gui.gui_running = False
        print("Registering an exit!")
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
