import logging
import time
import asyncio
import typing
import dronecan.driver
import pycyphal.transport.can
from pycyphal.transport.can import CANCapture, CANTransport
from pycyphal.transport.can.media import DataFrame, FrameFormat, Envelope

from yukon.domain.god_state import GodState


logger = logging.getLogger(__name__)

# logger.setLevel(logging.DEBUG)


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
        logger.debug("Receiving a message %r", can_capture)
        can_frame = dronecan.driver.CANFrame(can_capture.frame.identifier, can_capture.frame.data, True, canfd=False)
        state.dronecan_traffic_queues.input_queue.put_nowait(can_frame)

    return handle_transmit_message_to_dronecan


async def do_forward_dronecan_work(state: GodState) -> None:
    if not state.dronecan_traffic_queues.output_queue.empty():
        logger.debug("There are CAN frames to forward to dronecan")
        envelopes_to_send: typing.List[Envelope] = []
        redundant_transport = state.cyphal.local_node.presentation.transport
        max_work_counter = 0
        while not state.dronecan_traffic_queues.output_queue.empty() and max_work_counter < 200:
            frame: dronecan.driver.CANFrame = state.dronecan_traffic_queues.output_queue.get_nowait()
            max_work_counter += 1
            # This is a dronecan construct
            assert isinstance(frame, dronecan.driver.CANFrame)
            # This is a pycyphal construct
            frame_format: FrameFormat = FrameFormat.EXTENDED if frame.extended else FrameFormat.BASE
            # This is a pycyphal construct
            dataframe: DataFrame = DataFrame(frame_format, frame.id, frame.data)
            # This is a pycyphal construct
            envelopes_to_send.append(Envelope(dataframe, loopback=False))
        # Get the current monotonic time in this event loop, add one second to it
        # and send the envelopes
        async def send_these_frames():
            for inferior in redundant_transport.inferiors:
                if isinstance(inferior, CANTransport):
                    await inferior.spoof_frames(envelopes_to_send, asyncio.get_running_loop().time() + 1)

        state.cyphal_worker_asyncio_loop.call_soon_threadsafe(send_these_frames)
