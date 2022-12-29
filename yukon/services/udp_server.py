# Create a class that contains a UDPConnection field, start and stop methods
import queue
import socket
import threading
import time
from yukon.domain.udp_connection import UDPConnection


class _stop_object:
    pass


class UDPConnectionServer:
    def __init__(self, connection: UDPConnection):
        self.connection = connection
        self.socket = None
        self.json_strings_queue = queue.Queue()
        self.send_thread = None
        self.pause = False
        self.is_running = False

    def start(self):
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.socket.bind((self.connection.ip, self.connection.port))

        # Create a new thread with a while loop that send any string from the json_strings_queue to the socket
        def _send_json_strings():
            while self.socket.writable():
                self.is_running = True
                if self.pause:
                    time.sleep(0.1)
                    continue
                json_string = self.json_strings_queue.get()
                if isinstance(json_string, _stop_object):
                    break
                self.socket.sendto(json_string.encode(), (self.connection.ip, self.connection.port))
            self.is_running = False

        self.send_thread = threading.Thread(target=_send_json_strings, daemon=True)
        self.send_thread.start()

    def stop(self):
        # Clear the queue and add a stop object
        with self.json_strings_queue.mutex:
            self.json_strings_queue.queue.clear()
        self.json_strings_queue.put(_stop_object())
        self.socket.close()
