import threading
import webbrowser
from typing import Optional, Any
import os
import sys
import asyncio
import logging
from time import sleep
import subprocess

import sentry_sdk

from yukon.services.messages_publisher import MessagesPublisher
from yukon.services.cyphal_worker import cyphal_worker
from yukon.services.terminate_handler import make_terminate_handler

from yukon.domain.god_state import GodState
from yukon.sentry_setup import setup_sentry
from yukon.server import server, make_landing_and_bridge
from yukon.services.api import Api, SendingApi
from yukon.services.get_electron_path import get_electron_path

setup_sentry(sentry_sdk)
paths = sys.path

logger = logging.getLogger()
logger.setLevel("INFO")


def get_add_transport_url():
    parameters = ""
    # Check if os.environ contains "IS_SANITY_TEST"
    if os.environ.get("IS_SANITY_TEST"):
        parameters = "?sanity_test=true"
    return "http://localhost:5000/add_transport/add_transport.html" + parameters


def run_electron() -> None:
    # Make the thread sleep for 1 second waiting for the server to start
    sleep(1)
    exe_path = get_electron_path()
    # Use subprocess to run the exe
    try:
        # Keeping reading the stdout and stderr, look for the string electron: symbol lookup error
        with subprocess.Popen(
            [exe_path, get_add_transport_url()],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
        ) as p:
            while p.poll() is None:
                line1 = p.stdout.readline()  # type: ignore
                line2 = p.stderr.readline()  # type: ignore
                if (
                    (line1 and "electron: symbol lookup error" in line1)
                    or line2
                    and ("electron: symbol lookup error" in line2)
                ):
                    logger.error("There was an error while trying to run the electron app")
                    exit_code = 1
                    break
            if p.returncode is not None:
                exit_code = p.returncode

    except FileNotFoundError as e:
        logging.error(f"Could not find electron executable at {exe_path}")
        logging.error(e)
        exit_code = 1

    if exit_code != 0:
        logging.warning("Electron wasn't found or encountered an error, falling back to browser")
        os.environ["IS_BROWSER_BASED"] = "1"
        open_webbrowser()


def open_webbrowser() -> None:
    webbrowser.open(get_add_transport_url())


def run_server() -> None:
    server.run(host="0.0.0.0", port=5000)


def run_gui_app(state: GodState, api: Api, api2: SendingApi) -> None:
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

    def exit_handler(_arg1: Any, _arg2: Any) -> None:
        state.gui.gui_running = False
        sys.exit(0)

    # dpg.enable_docking(dock_space=False)
    make_terminate_handler(exit_handler)

    async def sendAMessage() -> None:
        # while await asyncio.sleep(1):
        #     await api2.send_message("Hello World")
        pass

    asyncio.get_event_loop().create_task(sendAMessage())
    start_server_thread = threading.Thread(target=run_server)
    start_server_thread.start()
    # if environment variable IS_BROWSER_BASED is set, open the webbrowser
    if os.environ.get("IS_BROWSER_BASED"):
        # Make a thread and call open_webbrowser() in it
        thread = threading.Thread(target=open_webbrowser)
        thread.start()
    else:
        start_electron_thread = threading.Thread(target=run_electron)
        start_electron_thread.start()
    while True:
        sleep(1)
        if not state.gui.gui_running:
            break
        else:
            print("GUI is still running")
    import multiprocessing

    for process in multiprocessing.active_children():
        process.terminate()
    exit_handler(None, None)
    state.gui.gui_running = False
    print("Trying to close the server")
    if state.failed_sanity_test:
        sys.exit(1)
    else:
        sys.exit(0)


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
    asyncio.get_event_loop().slow_callback_duration = 35
    if get_stop_after_value():
        auto_exit_thread = threading.Thread(target=auto_exit_task)
        auto_exit_thread.start()
    state: GodState = GodState()
    api: Api = Api(state)
    api2: SendingApi = SendingApi()
    run_gui_app(state, api, api2)
    if get_stop_after_value():
        auto_exit_thread.join()
    return 0


if __name__ == "__main__":
    asyncio.run(main())
    sys.exit(0)
