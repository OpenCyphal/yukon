# pip install dronecan

import os
import sys
from pathlib import Path
import multiprocessing
import logging

from dronecan.driver.common import AbstractDriver
from dronecan.node import Node

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
    FRAME_DIRECTION_INCOMING = 'rx'
    FRAME_DIRECTION_OUTGOING = 'tx'

    class HookRemover:
        def __init__(self, remover):
            self.remove = remover

    def __init__(self):
        self._io_hooks = []

    def add_io_hook(self, hook):
        """
        Args:
            hook:   This hook will be invoked for every incoming and outgoing CAN frame.
                    Hook arguments: (direction, frame)
                    See FRAME_DIRECTION_*, CANFrame.
        """

        def proxy(*args):
            hook(*args)

        self._io_hooks.append(proxy)

        return self.HookRemover(lambda: self._io_hooks.remove(proxy))

    def _call_io_hooks(self, direction, frame):
        for h in self._io_hooks:
            try:
                h(direction, frame)
            except Exception as ex:
                logger.error('Uncaught exception from CAN IO hook: %r', ex, exc_info=True)

    def _tx_hook(self, frame):
        self._call_io_hooks(self.FRAME_DIRECTION_OUTGOING, frame)

    def _rx_hook(self, frame):
        self._call_io_hooks(self.FRAME_DIRECTION_INCOMING, frame)

    def set_filter_list(self, ids):
        """set list of message IDs to accept, sent to the remote capture node with mavcan"""
        pass

    def get_filter_list(self, ids):
        """get list of message IDs to accept, None means accept all"""
        return None

    def set_bus(self, busnum):
        """set the remote bus number to attach to"""
        pass

    def get_bus(self):
        """get the remote bus number we are attached to"""
        return None

    def get_filter_list(self):
        """get the current filter list"""
        return None


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
                print('Node error:', ex)

    allocator.close()
    node_monitor.close()


if __name__ == '__main__':
    multiprocessing.freeze_support()
    print("sys.argv", sys.argv)
    main(*sys.argv)
