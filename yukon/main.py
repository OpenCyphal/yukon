import socket
import threading
import webbrowser
from typing import Optional, Any
import os
import sys
from pathlib import Path
import asyncio
import logging
from time import sleep, monotonic
import subprocess
import mimetypes
import sentry_sdk
from yukon.domain.interface import Interface

from yukon.services.messages_publisher import MessagesPublisher
from yukon.services.cyphal_worker import cyphal_worker
from yukon.services.terminate_handler import make_terminate_handler

from yukon.domain.god_state import GodState
from yukon.sentry_setup import setup_sentry
from yukon.server import server, make_landing_and_bridge
from yukon.services.api import Api, SendingApi
from yukon.services.get_electron_path import get_electron_path

from yukon.domain.attach_transport_request import AttachTransportRequest
from yukon.domain.attach_transport_response import AttachTransportResponse


mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("text/html", ".html")

setup_sentry(sentry_sdk)
paths = sys.path

logger = logging.getLogger()
logger.setLevel("INFO")

if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    root_path = sys._MEIPASS  # type: ignore # pylint: disable=protected-access
else:
    print("running in a normal Python process")
    root_path = os.path.dirname(os.path.abspath(__file__))


def run_electron(state: GodState) -> None:
    # Make the thread sleep for 1 second waiting for the server to start
    while not state.gui.is_port_decided:
        sleep(1)
    exe_path = get_electron_path()
    # Use subprocess to run the exe
    try:
        # Keeping reading the stdout and stderr, look for the string electron: symbol lookup error
        os.environ["YUKON_SERVER_PORT"] = str(state.gui.server_port)
        logger.info("YUKON_SERVER_PORT=%s", os.environ["YUKON_SERVER_PORT"])
        print(root_path)
        with subprocess.Popen(
            [exe_path, Path(root_path) / "electron/main.js"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            env=os.environ,
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
                logger.debug(line1)
                logger.error(line2)
            if p.returncode is not None:
                exit_code = p.returncode

    except FileNotFoundError as e:
        # Log the same but using lazy logging
        logging.error("Could not find electron executable at %s", exe_path)
        logging.exception(str(e))
        exit_code = 1

    if exit_code != 0:
        logging.warning("Electron wasn't found or encountered an error, falling back to browser")
        os.environ["IS_BROWSER_BASED"] = "1"
        open_webbrowser(state)


def open_webbrowser(state: GodState) -> None:
    while not state.gui.is_port_decided:
        sleep(1)
    webbrowser.open(f"http://localhost:{state.gui.server_port}/main/main.html")


def run_server(state: GodState) -> None:
    # Check if the port state.gui.server_port is available, means that it can be used
    # If it is not available, then increment the port number and check again
    # If it is available, then use it
    while True:
        a_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        location = ("127.0.0.1", state.gui.server_port)
        is_port_available = a_socket.connect_ex(location) != 0
        a_socket.close()
        if not is_port_available:
            state.gui.server_port += 1
            continue
        state.gui.is_port_decided = True
        try:
            server.run(host="0.0.0.0", port=state.gui.server_port)
        except:
            logger.exception("Server was unable to start or crashed.")


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
    start_server_thread = threading.Thread(target=run_server, args=[state], daemon=True)
    start_server_thread.start()
    # if environment variable IS_BROWSER_BASED is set, open the webbrowser
    if not os.environ.get("IS_HEADLESS"):
        if os.environ.get("IS_BROWSER_BASED"):
            # Make a thread and call open_webbrowser() in it
            thread = threading.Thread(target=open_webbrowser, args=[state], daemon=True)
            thread.start()
        else:
            start_electron_thread = threading.Thread(target=run_electron, args=[state], daemon=True)
            start_electron_thread.start()
    if (
        os.environ.get("IS_HEADLESS")
        and os.environ.get("YUKON_UDP_IFACE")
        and os.environ.get("YUKON_NODE_ID")
        and os.environ.get("YUKON_UDP_MTU")
    ):
        interface: Interface = Interface()
        interface.is_udp = True
        interface.udp_iface = os.environ.get("YUKON_UDP_IFACE")
        interface.udp_mtu = int(os.environ.get("YUKON_UDP_MTU"))  # type: ignore
        atr: AttachTransportRequest = AttachTransportRequest(interface, int(os.environ.get("YUKON_NODE_ID")))  # type: ignore
        state.queues.attach_transport.put(atr)
        required_queue_timeout: Optional[int] = 4
        if os.environ.get("IS_DEBUG"):
            required_queue_timeout = None
        response: AttachTransportResponse = state.queues.attach_transport_response.get(timeout=required_queue_timeout)
        if not response.success:
            raise Exception("Failed to attach transport", response.message)

    while True:
        sleep(1)
        time_since_last_poll = monotonic() - state.gui.last_poll_received
        if state.gui.last_poll_received != 0 and time_since_last_poll > 3 and not os.environ.get("IS_DEBUG"):
            logging.debug("No poll received in 3 seconds, shutting down")
            state.gui.gui_running = False
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
