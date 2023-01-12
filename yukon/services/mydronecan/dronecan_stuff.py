# pip install dronecan

import math
import os
import queue
import sys
import threading
import time
from pathlib import Path
import logging

import typing
import dronecan.app.node_monitor
from dronecan.driver.common import AbstractDriver, CANFrame
from dronecan.node import Node

from yukon.domain.god_state import GodState

from dronecan import make_node, UAVCANException, make_driver
from dronecan.app.dynamic_node_id import CentralizedServer
from yukon.services.mydronecan.file_server import SimpleFileServer
from yukon.services.mydronecan.node_monitor import NodeMonitor
from dronecan import uavcan

logger = logging.getLogger(__name__)
# logger.setLevel(logging.DEBUG)


class GoodDriver(AbstractDriver):
    def __init__(self, state: GodState):
        self.state = state

    def send(
        self,
        message_id: int,
        message: bytearray,
        extended: bool,
        ts_monotonic: typing.Optional[float] = None,
        ts_real: typing.Optional[float] = None,
        canfd: bool = False,
    ) -> None:
        frame = CANFrame(message_id, message, extended, canfd=canfd)
        if len(self.state.cyphal.local_node.presentation.transport.inferiors) > 0:
            logger.debug("Sending CAN frame: %r", frame)
            self.state.dronecan_traffic_queues.output_queue.put_nowait(frame)
        else:
            logger.debug("Not sending CAN frame %r", frame)

    def receive(self, timeout: typing.Optional[float] = None) -> typing.Optional[CANFrame]:
        try:
            logger.debug("The timeout is %r", timeout)
            received_frame = self.state.dronecan_traffic_queues.input_queue.get(timeout=timeout or math.inf)
            logger.debug("Received CAN frame: %r", received_frame)
            return received_frame
        except queue.Empty:
            return None


def run_dronecan(state: GodState) -> None:
    logger.debug("Starting DroneCAN firmware updater")
    state.dronecan.allocator = None
    state.dronecan.node_monitor = None
    try:
        state.dronecan.driver = GoodDriver(state)
        state.dronecan.node = Node(state.dronecan.driver, node_id=123)
        logger.debug("Node %r created", state.dronecan.node)
        # Add the current directory to the paths list
        state.dronecan.node_monitor = NodeMonitor(state.dronecan.node)

        def update_entries() -> None:
            found_entries = list(state.dronecan.node_monitor.find_all(lambda x: True))
            state.dronecan.all_entries = found_entries

        def update_entries_loop() -> None:
            while state.gui.gui_running:
                update_entries()
                time.sleep(1)

        update_entries_thread = threading.Thread(target=update_entries_loop, daemon=True)
        update_entries_thread.start()
        # It is NOT necessary to specify the database storage.
        # If it is not specified, the allocation table will be kept in memory, thus it will not be persistent.
        state.dronecan.allocator = CentralizedServer(state.dronecan.node, state.dronecan.node_monitor)
        if state.dronecan.firmware_update_enabled.value and not state.dronecan.fileserver:
            state.dronecan.fileserver = SimpleFileServer(state.dronecan.node, state.dronecan.firmware_update_path.value)
            state.dronecan.fileserver.start()
        # def node_update(event: "dronecan.app.node_monitor.NodeMonitor.UpdateEvent") -> None:
        #     if (
        #         event.event_id == event.EVENT_ID_NEW
        #         and state.dronecan.firmware_update_enabled.value
        #         and len(state.dronecan.firmware_update_path.value) > 1
        #     ):
        #         req = uavcan.protocol.file.BeginFirmwareUpdate.Request()
        #         req.image_file_remote_path.path = "a"
        #         logging.debug("Sending %r to %r", req, event.entry.node_id)
        #         print("A node will need an update")
        #         state.dronecan.node.request(req, event.entry.node_id, lambda e: None)

        # state.dronecan.node_monitor.add_update_handler(node_update)
        state.dronecan.is_running = True
        # The allocator and the node monitor will be running in the background, requiring no additional attention
        # When they are no longer needed, they should be finalized by calling close():
        while state.gui.gui_running and state.dronecan.is_running:
            try:
                state.dronecan.node.spin()  # Spin forever or until an exception is thrown
            except UAVCANException as ex:
                if "Toggle bit value" not in str(ex):
                    print("Node error:", ex)
        state.dronecan.is_running = False
    except Exception as ex:
        logger.debug("DroneCAN node start failed: %r", ex)
        if state.dronecan.allocator:
            state.dronecan.allocator.close()
        if state.dronecan.node_monitor:
            state.dronecan.node_monitor.close()


# if __name__ == "__main__":
#     multiprocessing.freeze_support()
#     print("sys.argv", sys.argv)
#     main(*sys.argv)
