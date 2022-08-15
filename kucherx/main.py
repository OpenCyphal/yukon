import copy
import threading
import typing
import webbrowser
from queue import Empty
from typing import Optional, Any
import os
import sys
import asyncio
import logging
from time import sleep
import json

import sentry_sdk
from serial.tools import list_ports

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
from kucherx.server import server, make_landing
from kucherx.services.api import Api

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


def run_gui_app(state: GodState, api: Api) -> None:
    messages_publisher = MessagesPublisher(state)
    messages_publisher.setLevel(logging.NOTSET)
    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    messages_publisher.setFormatter(formatter)
    logger.addHandler(messages_publisher)
    make_process_dpi_aware(logger)
    make_landing(state, api)
    # Creating 3 new threads
    start_threads(state)

    def open_webbrowser():
        webbrowser.open("http://localhost:5000")

    threading.Thread(target=open_webbrowser).start()
    server.run(host='0.0.0.0', port=5000)

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
    state: GodState = GodState()
    api: Api = Api(state)
    run_gui_app(state, api)
    if get_stop_after_value():
        auto_exit_thread.join()
    return 0


if __name__ == "__main__":
    asyncio.run(main())
    sys.exit(0)
