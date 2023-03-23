import logging
from queue import Empty
import time
import asyncio
import typing
import dronecan.driver
import pycyphal.transport.can
from pycyphal.transport.can import CANCapture, CANTransport
from pycyphal.transport.can.media import DataFrame, FrameFormat, Envelope

from yukon.domain.god_state import GodState


logger = logging.getLogger(__name__)


def make_handler_for_transmit(state: GodState) -> typing.Callable[[pycyphal.transport.can.CANCapture], None]:
    def handle_transmit_message_to_dronecan(can_capture: pycyphal.transport.can.CANCapture) -> None:
        if not isinstance(can_capture, CANCapture):
            logger.debug("Not forwarding a message %r, it's not a cancapture", can_capture)
            return
        if not state.dronecan.is_running:
            logger.debug("Not forwarding a message %r, dronecan is not running", can_capture)
            return
        # if can_capture.own:
        #     logger.debug("Not forwarding a message %r, it is an own message", can_capture)
        #     return
        # logger.debug("Receiving a message %r", can_capture)
        can_frame = dronecan.driver.CANFrame(can_capture.frame.identifier, can_capture.frame.data, True, canfd=False)
        state.dronecan_traffic_queues.input_queue.put(can_frame)

    return handle_transmit_message_to_dronecan
