import signal
import socket
import threading
import time
import webbrowser
import typing
from typing import Optional, Any
import os
import sys
import argparse
from pathlib import Path
import asyncio
import logging
from time import sleep, monotonic
import subprocess
import mimetypes

import psutil
import sentry_sdk
from yukon.custom_tk_dialog import launch_yes_no_dialog

from yukon.services.settings_handler import loading_settings_into_yukon
from yukon.services.cyphal_worker.cyphal_worker import cyphal_worker

from yukon.domain.interface import Interface
from yukon.domain.transport.attach_transport_request import AttachTransportRequest
from yukon.domain.transport.attach_transport_response import AttachTransportResponse
from yukon.domain.god_state import GodState
from yukon.services.messages_publisher import MessagesPublisher
from yukon.services.terminate_handler import make_terminate_handler
from yukon.services.api import Api, SendingApi
from yukon.services.get_electron_path import get_electron_path
from yukon.sentry_setup import setup_sentry
from yukon.server import server, make_landing_and_bridge

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
    root_path = str(Path(os.path.dirname(os.path.abspath(__file__))).parent)


def run_electron(state: GodState) -> None:
    # Make the thread sleep for 1 second waiting for the server to start
    while not state.gui.is_port_decided:
        sleep(1)

    exe_path = get_electron_path()
    electron_logger = logger.getChild("electronJS")
    electron_logger.setLevel("DEBUG")
    # electron_logger.addHandler(state.messages_publisher)
    exit_code = 0
    # Use subprocess to run the exe
    try:
        # Keeping reading the stdout and stderr, look for the string electron: symbol lookup error
        os.environ["YUKON_SERVER_PORT"] = str(state.gui.server_port)
        with subprocess.Popen(
            [exe_path, Path(root_path) / "yukon/electron/main.js"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            env=os.environ,
        ) as p:

            def receive_stdout() -> None:
                nonlocal exit_code
                while p.poll() is None and p.stdout:
                    line1 = p.stdout.readline()
                    if line1 and line1.strip() != "":
                        if "electron: symbol lookup error" in line1:
                            electron_logger.error("There was an error while trying to run the electron app")
                            exit_code = 1
                            p.kill()
                            break
                        electron_logger.info(line1)

            def receive_stderr() -> None:
                nonlocal exit_code
                while p.poll() is None and p.stderr:
                    line2 = p.stderr.readline()
                    if line2:
                        electron_logger.error(line2)
                        if "electron: symbol lookup error" in line2:
                            electron_logger.error("There was an error while trying to run the electron app")
                            exit_code = 1
                            p.kill()
                            break

            stdout_thread = threading.Thread(target=receive_stdout, daemon=True)
            stdout_thread.start()
            stderr_thread = threading.Thread(target=receive_stderr, daemon=True)
            stderr_thread.start()
            stderr_thread.join()
            stdout_thread.join()
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


def webbrowser_open_wrapper(url: str) -> bool:
    """This one has a timeout"""
    # if the webbrowser.open function doesn't return in 1 second then return false
    # run the webbrowser.open function in a thread and return its return value if it returns in 1 second
    # if it doesn't return in 1 second then return false
    logger.info("The time-outing webbrowser.open function is being called")
    did_open_webbrowser = False

    def run_webbrowser_open() -> None:
        nonlocal did_open_webbrowser
        did_open_webbrowser = webbrowser.open(url)

    t = threading.Thread(target=run_webbrowser_open, daemon=True)
    t.start()
    start_time = monotonic()
    while t.is_alive():
        if monotonic() - start_time > 1:
            return False
        sleep(0.1)
        logger.info("Timeout function is sleeping")
    return did_open_webbrowser


def open_webbrowser(state: GodState) -> None:
    while not state.gui.is_port_decided:
        sleep(0.5)
    logger.info("Opening web browser")
    tried_webbrowser_open = False
    tried_xdg_open_or_similar = False
    browser_not_opened_counter = 0
    while not state.gui.is_running_in_browser and state.gui.gui_running:
        if not tried_webbrowser_open:
            webbrowser_open_wrapper(f"http://127.0.0.1:{state.gui.server_port}/main/main.html")
            tried_webbrowser_open = True

        # Use a shell to launch chrome and firefox on url f"http://localhost:{state.gui.server_port}/main/main.html"
        # If the user is on linux, then use xdg-open
        # If the user is on mac, then use open
        # If the user is on windows, then use start
        # If the user is on any other OS, then use the default browser
        if tried_webbrowser_open and not tried_xdg_open_or_similar:
            if sys.platform == "linux":
                logger.info("Using xdg-open to open the browser")
                subprocess.call(["xdg-open", f"http://127.0.0.1:{state.gui.server_port}/main/main.html"])
                tried_xdg_open_or_similar = True
            elif sys.platform == "darwin":
                logger.info("Using open to open the browser")
                subprocess.call(["open", f"http://127.0.0.1:{state.gui.server_port}/main/main.html"])
                tried_xdg_open_or_similar = True
            elif sys.platform == "win32":
                logger.info("Using start to open the browser")
                subprocess.call(["start", f"http://127.0.0.1:{state.gui.server_port}/main/main.html"])
                tried_xdg_open_or_similar = True

        if tried_webbrowser_open and tried_xdg_open_or_similar:
            logger.warning(
                "The browser wasn't opened, please open it manually at URL %s",
                f"http://127.0.0.1:{state.gui.server_port}/main/main.html?port={state.gui.server_port}",
            )
            browser_not_opened_counter += 1
            if browser_not_opened_counter > 10:
                logger.error("The browser wasn't opened, exiting")
                state.gui.gui_running = False
                # Send a sigterm signal
                os.kill(os.getpid(), signal.SIGTERM)
        sleep(2)
    if state.gui.gui_running:
        print("Good to go, Yukon is now open in a browser.")
    else:
        print("Open webbrowser thread is closed.")


def run_server(state: GodState) -> None:
    # Check if the port state.gui.server_port is available, means that it can be used
    # If it is not available, then increment the port number and check again
    # If it is available, then use it
    while not state.gui.is_port_decided and state.gui.gui_running:
        a_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        location = ("127.0.0.1", state.gui.server_port)
        is_port_available = a_socket.connect_ex(location) != 0
        a_socket.close()
        if not is_port_available:
            state.gui.server_port += 1
            continue
        state.gui.is_port_decided = True
    try:
        server.run(host="0.0.0.0", port=state.gui.server_port, threaded=True)
    except:  # pylint: disable=bare-except
        logger.exception("Server was unable to start or crashed.")


def set_logging_levels() -> None:
    logging.getLogger("pycyphal").setLevel(logging.WARNING)
    logging.getLogger("can").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.CRITICAL)
    logging.getLogger("werkzeug").setLevel(logging.CRITICAL)
    logging.getLogger("pycyphal.transport.can.media.pythoncan._pythoncan").setLevel(logging.CRITICAL)


def find_yukon_processes() -> typing.List[psutil.Process]:
    "Return a list of Yukon processes."
    # Save a list of all processes with their name, pid and ppid, general_process_list
    # Iterate once through the list to find all the processes with the word electron in their name,
    # add the ppid's of these processes to a set
    # Iterate over the list of processes again,
    # looking for processes with a ppid in the set that also contain Yukon in their name
    # Return the list of processes that match the above criteria
    general_process_list = list(psutil.process_iter(["name", "pid", "ppid"]))
    ppid_set = set()
    for p in general_process_list:
        if "electron" in p.info["name"]:
            ppid_set.add(p.info["ppid"])
    yukon_processes = []
    for p in general_process_list:
        if p.info["pid"] in ppid_set and "Yukon" in p.info["name"]:
            yukon_processes.append(p)
    return yukon_processes


def handle_headless_yukon(state: GodState) -> None:
    if (
        state.gui.is_headless
        and os.environ.get("YUKON_UDP_IFACE")
        and os.environ.get("YUKON_NODE_ID")
        and os.environ.get("YUKON_UDP_MTU")
    ):
        interface: Interface = Interface()
        interface.is_udp = True
        interface.udp_iface = os.environ.get("YUKON_UDP_IFACE")
        interface.udp_mtu = int(os.environ.get("YUKON_UDP_MTU"))  # type: ignore
        atr: AttachTransportRequest = AttachTransportRequest(
            interface, int(os.environ.get("YUKON_NODE_ID"))  # type: ignore
        )
        state.queues.attach_transport.put(atr)
        required_queue_timeout: Optional[int] = 4
        if os.environ.get("IS_DEBUG"):
            required_queue_timeout = None
        response: AttachTransportResponse = state.queues.attach_transport_response.get(timeout=required_queue_timeout)
        if not response.is_success:
            raise Exception("Failed to attach transport", response.message)


def run_gui_app(state: GodState, api: Api, api2: SendingApi) -> None:
    loading_settings_into_yukon(state)
    set_logging_levels()
    state.messages_publisher = MessagesPublisher(state)
    state.messages_publisher.setLevel(logging.NOTSET)
    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    state.messages_publisher.setFormatter(formatter)
    logger.addHandler(state.messages_publisher)
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
    if not state.gui.is_headless:
        if os.environ.get("IS_BROWSER_BASED"):
            # Make a thread and call open_webbrowser() in it
            thread = threading.Thread(target=open_webbrowser, args=[state], daemon=True)
            thread.start()
        else:
            start_electron_thread = threading.Thread(target=run_electron, args=[state], daemon=True)
            start_electron_thread.start()
            # Make a thread that will check if state.is_target_client_known is True
            # and state.is_running_in_browser is False after 10 seconds
            # If it isn't then try opening a web browser
            def check_if_electron_is_running() -> None:
                time.sleep(10)
                if not state.gui.is_running_in_browser and state.gui.is_target_client_known:
                    open_webbrowser(state)

            thread = threading.Thread(target=check_if_electron_is_running, daemon=True)
    else:
        os.environ.setdefault("IS_DEBUG", "1")
    handle_headless_yukon(state)
    while True:
        sleep(1)
        time_since_last_poll = monotonic() - state.gui.last_poll_received
        is_running_in_browser = state.gui.is_target_client_known and state.gui.is_running_in_browser
        if (
            state.gui.last_poll_received != 0
            and time_since_last_poll > state.gui.time_allowed_between_polls
            and not os.environ.get("IS_DEBUG")
            and not state.gui.is_headless
            and is_running_in_browser
        ):
            logging.debug("No poll received in 3 seconds, shutting down")
            state.gui.gui_running = False
        if not state.gui.gui_running:
            break
    exit_handler(None, None)


def get_stop_after_value() -> Optional[str]:
    return os.environ.get("STOP_AFTER")


def auto_exit_task() -> int:
    if get_stop_after_value():
        stop_after_value = int(get_stop_after_value())  # type: ignore
        if stop_after_value:
            sleep(stop_after_value)
            logging.info("Program should exit!")
    return 0


async def main(is_headless: bool, port: Optional[int] = None, should_look_at_arguments: bool = True) -> int:
    from yukon.version import __version__

    print("Version of Yukon: " + __version__)
    if is_headless:
        print("Running in headless mode")
    found_yukons = find_yukon_processes()
    for proc in found_yukons:
        logger.info("Found Yukon process: %r", proc)
    if len(found_yukons) > 0:  # There are some subprocesses actually too and these are counted here I am afraid
        logger.warning("Yukon is already running.")
        logger.warning("This might be unintentional.")

        if launch_yes_no_dialog("Would you like to close " + str(len(found_yukons)) + " other Yukon instances?"):
            logger.warning("Closing other Yukon instances.")
            for proc in found_yukons:
                id_of_parent_process = proc.ppid()
                parent = psutil.Process(id_of_parent_process)
                for child in parent.children(recursive=True):  # or parent.children() for recursive=False
                    child.kill()

    else:
        logger.info("No other Yukon is not running.")
    asyncio.get_event_loop().slow_callback_duration = 35
    if get_stop_after_value():
        auto_exit_thread = threading.Thread(target=auto_exit_task)
        auto_exit_thread.start()
    state: GodState = GodState()
    args = None
    if should_look_at_arguments:
        parser: argparse.ArgumentParser = argparse.ArgumentParser("Yukon")
        parser.add_argument("--port", type=int, help="Port to use for the internal webserver")
        # Read the port argument to state.gui.server_port
        args = parser.parse_args()
    state.gui.is_headless = is_headless
    if not state.gui.is_headless:
        if os.environ.get("IS_HEADLESS"):
            state.gui.is_headless = True
    if port:
        state.gui.server_port = port
        state.gui.is_port_decided = True
    elif args:
        if args.port:
            state.gui.server_port = args.port
            state.gui.is_port_decided = True
    api: Api = Api(state)
    api2: SendingApi = SendingApi()
    run_gui_app(state, api, api2)
    if get_stop_after_value():
        auto_exit_thread.join()
    return 0


if __name__ == "__main__":
    asyncio.run(main(False))
    sys.exit(0)
