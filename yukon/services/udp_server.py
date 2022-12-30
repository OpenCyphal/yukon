import queue
import socket
import threading
import time
import typing
from yukon.domain.udp_connection import UDPConnection


class _stop_object:
    pass


class UDPConnectionServer:
    def __init__(self, connection: UDPConnection) -> None:
        self.connection: UDPConnection = connection
        self.socket: typing.Optional["socket.socket"] = None
        self.json_strings_queue: queue.Queue = queue.Queue()
        self.send_thread: typing.Optional[threading.Thread] = None
        self.pause: bool = False
        self.is_running: bool = False

    def start(self) -> None:
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # self.socket.bind((self.connection.ip, self.connection.port))

        # Create a new thread with a while loop that send any string from the json_strings_queue to the socket
        def _send_json_strings() -> None:
            while not self.socket._closed:  # type: ignore
                self.is_running = True
                if self.pause:
                    time.sleep(0.1)
                    continue
                json_string = self.json_strings_queue.get()
                if isinstance(json_string, _stop_object):
                    break
                self.socket.sendto(json_string.encode(), (self.connection.ip, self.connection.port))  # type: ignore
            self.is_running = False

        self.send_thread = threading.Thread(target=_send_json_strings, daemon=True)
        self.send_thread.start()

    def send(self, json_string: str) -> None:
        self.json_strings_queue.put(json_string)

    def stop(self) -> None:
        # Clear the queue and add a stop object
        with self.json_strings_queue.mutex:
            self.json_strings_queue.queue.clear()
        self.json_strings_queue.put(_stop_object())
        self.socket.close()  # type: ignore

    def close(self) -> None:
        self.stop()
