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

logger.setLevel(logging.DEBUG)


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


async def do_forward_dronecan_work(state: GodState) -> None:
    logger.debug("There are CAN frames to forward to dronecan")
    frames_to_send: typing.List[Envelope] = []
    redundant_transport = state.cyphal.local_node.presentation.transport
    max_work_counter = 0
    first_frame = await state.dronecan_traffic_queues.output_queue.get()
    if not isinstance(first_frame, dronecan.driver.CANFrame):
        logger.warning("Not a dronecan frame")
        return
    # This is a pycyphal construct
    frame_format1: FrameFormat = FrameFormat.EXTENDED if first_frame.extended else FrameFormat.BASE
    # This is a pycyphal construct
    dataframe1: DataFrame = DataFrame(frame_format1, first_frame.id, first_frame.data)
    # This is a pycyphal construct
    frames_to_send.append(dataframe1)
    while state.gui.gui_running:
        if max_work_counter > 5000 or state.dronecan_traffic_queues.output_queue.empty():
            break
        max_work_counter += 1
        try:
            frame: dronecan.driver.CANFrame = state.dronecan_traffic_queues.output_queue.get_nowait()
            if not isinstance(frame, dronecan.driver.CANFrame):
                logger.warning("Not a dronecan frame")
                break
            # This is a pycyphal construct
            frame_format: FrameFormat = FrameFormat.EXTENDED if frame.extended else FrameFormat.BASE
            # This is a pycyphal construct
            dataframe: DataFrame = DataFrame(frame_format, frame.id, frame.data)
            # This is a pycyphal construct
            frames_to_send.append(dataframe)
        except Empty:
            break
    # Get the current monotonic time in this event loop, add one second to it
    # and send the envelopes
    async def send_these_frames() -> None:
        for inferior in redundant_transport.inferiors:
            if isinstance(inferior, CANTransport):
                await inferior.spoof_frames(frames_to_send, asyncio.get_running_loop().time() + 1)

    logger.debug(len(frames_to_send))
    if len(frames_to_send) > 0:
        state.cyphal_worker_asyncio_loop.create_task(send_these_frames())
        logger.debug("Sent %d frames", len(frames_to_send))
