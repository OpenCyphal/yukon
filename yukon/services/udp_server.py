# Create a class that contains a UDPConnection field, start and stop methods
import queue
import socket
import threading
import time
from yukon.domain.udp_connection import UDPConnection


class UDPConnectionServer:
    def __init__(self, connection: UDPConnection):
        self.connection = connection
        self.socket = None
        self.json_strings_queue = queue.Queue()
        self.send_thread = None
        self.pause = False

    def start(self):
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.socket.bind((self.connection.ip, self.connection.port))

        # Create a new thread with a while loop that send any string from the json_strings_queue to the socket
        def _send_json_strings():
            while self.socket.writable():
                if self.pause:
                    time.sleep(0.1)
                    continue
                json_string = self.json_strings_queue.get()
                self.socket.sendto(json_string.encode(), (self.connection.ip, self.connection.port))

        self.send_thread = threading.Thread(target=_send_json_strings, daemon=True)
        self.send_thread.start()

    def stop(self):
        self.socket.close()
