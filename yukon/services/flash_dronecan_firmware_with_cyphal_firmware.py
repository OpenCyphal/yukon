# pip install dronecan

import os
import queue
import sys
import time
from pathlib import Path
import multiprocessing
import logging

import typing
from dronecan.driver.common import AbstractDriver, CANFrame
from dronecan.node import Node

from domain.god_state import GodState

logging.basicConfig(level=logging.INFO)
# Add dronecan to path from the parent directory
parent_dir = Path(__file__).parent.parent
sys.path.append(str(parent_dir))
from dronecan import make_node, UAVCANException, make_driver
from dronecan.app.dynamic_node_id import CentralizedServer
from dronecan.app.file_server import FileServer
from dronecan.app.node_monitor import NodeMonitor
from dronecan import uavcan


class GoodDriver(AbstractDriver):
    def __init__(self, state: GodState):
        self.state = state
        self._io_hooks = []

    def send(
        self,
        message_id: int,
        message: bytearray,
        extended: bool,
        ts_monotonic: typing.Optional[float] = None,
        ts_real: typing.Optional[float] = None,
        canfd: bool = False,
    ):
        frame = CANFrame(message_id, message, extended, canfd=canfd)
        self.state.dronecan_traffic_queues.output_queue.put_nowait(frame)

    def receive(self, timeout: float = 0.0) -> typing.Optional[CANFrame]:
        if timeout is None:
            deadline = None
        elif timeout == 0:
            deadline = 0
        else:
            deadline = time.monotonic() + timeout
        while not self.state.dronecan_traffic_queues.input_queue.empty():
            try:
                if deadline is None:
                    get_timeout = None
                elif deadline == 0:
                    # TODO this is a workaround. Zero timeout causes the IPC queue to ALWAYS throw queue.Empty!
                    get_timeout = 1e-3
                else:
                    # TODO this is a workaround. Zero timeout causes the IPC queue to ALWAYS throw queue.Empty!
                    get_timeout = max(1e-3, deadline - time.monotonic())

                return self.state.dronecan_traffic_queues.input_queue.get(timeout=get_timeout)
            except queue.Empty:
                return


def main(current_file_path, port, file_name):
    can = GoodDriver()
    node = Node(can, node_id=123)
    # Add the current directory to the paths list
    file_server = FileServer(node, ["/"])  # This is secure!
    node_monitor = NodeMonitor(node)
    # It is NOT necessary to specify the database storage.
    # If it is not specified, the allocation table will be kept in memory, thus it will not be persistent.
    allocator = CentralizedServer(node, node_monitor, database_storage=Path(os.getcwd()) / "allocation.db")

    def node_update(event):
        if event.event_id == event.EVENT_ID_NEW:
            req = uavcan.protocol.file.BeginFirmwareUpdate.Request()
            req.image_file_remote_path.path = str(Path(os.getcwd()) / file_name)
            logging.warning("Sending %r to %r", req, event.entry.node_id)
            node.request(req, event.entry.node_id, lambda e: None)

    node_monitor.add_update_handler(node_update)

    # The allocator and the node monitor will be running in the background, requiring no additional attention
    # When they are no longer needed, they should be finalized by calling close():
    while True:
        try:
            node.spin()  # Spin forever or until an exception is thrown
        except UAVCANException as ex:
            if "Toggle bit value" not in str(ex):
                print("Node error:", ex)

    allocator.close()
    node_monitor.close()


if __name__ == "__main__":
    multiprocessing.freeze_support()
    print("sys.argv", sys.argv)
    main(*sys.argv)
