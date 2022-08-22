import threading
import webbrowser
from pathlib import Path
from typing import Optional, Any
import os
import sys
import asyncio
import logging
from time import sleep

import sentry_sdk

from yukon.services.messages_publisher import MessagesPublisher
from yukon.services.cyphal_worker import cyphal_worker
from yukon.services.terminate_handler import make_terminate_handler

from yukon.domain.god_state import GodState
from yukon.sentry_setup import setup_sentry
from yukon.server import server, make_landing_and_bridge
from yukon.services.api import Api

setup_sentry(sentry_sdk)
paths = sys.path

logger = logging.getLogger()
logger.setLevel("INFO")


def run_electron() -> None:
    # Make the thread sleep for 1 second waiting for the server to start
    sleep(1)
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        root_path = Path(sys._MEIPASS).absolute() / "yukon"  # type: ignore # pylint: disable=protected-access
    else:
        print('running in a normal Python process')
        root_path = Path(__file__).absolute().parent

    # if platform is windows
    if sys.platform == "win32":
        exe = root_path.parent / "electron" / "electron.exe"
    else:
        exe = root_path.parent / "electron" / "electron"

    # Use subprocess to run the exe
    os.spawnl(os.P_NOWAIT, exe, exe, "http://localhost:5000")
    os.spawnl(os.P_NOWAIT, exe, exe, "http://localhost:5000/main")


def run_gui_app(state: GodState, api: Api) -> None:
    logging.getLogger("pycyphal").setLevel(logging.INFO)
    logging.getLogger("can").setLevel(logging.INFO)
    logging.getLogger("asyncio").setLevel(logging.CRITICAL)
    logging.getLogger("werkzeug").setLevel(logging.CRITICAL)

    messages_publisher = MessagesPublisher(state)
    messages_publisher.setLevel(logging.NOTSET)
    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    messages_publisher.setFormatter(formatter)
    logger.root.addHandler(messages_publisher)
    make_landing_and_bridge(state, api)

    cyphal_worker_thread = threading.Thread(target=cyphal_worker, args=[state])
    cyphal_worker_thread.start()

    def run_server() -> None:
        server.run(host="0.0.0.0", port=5000)

    def open_webbrowser() -> None:
        webbrowser.open("http://localhost:5000/")

    # Make a thread and call open_webbrowser() in it
    thread = threading.Thread(target=open_webbrowser)
    thread.start()

    def exit_handler(_arg1: Any, _arg2: Any) -> None:
        state.gui.gui_running = False
        sys.exit(0)

    # dpg.enable_docking(dock_space=False)
    make_terminate_handler(exit_handler)
    # start_electron_thread = threading.Thread(target=run_electron)
    # start_electron_thread.start()
    start_server_thread = threading.Thread(target=run_server)
    start_server_thread.start()
    while True:
        sleep(1)
        if not state.gui.gui_running:
            break
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
