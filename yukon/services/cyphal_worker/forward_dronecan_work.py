import typing
import dronecan.driver
from pycyphal.transport.can import CANCapture, CANTransport
from pycyphal.transport.can.media import DataFrame, FrameFormat, Envelope

from domain.god_state import GodState


async def do_forward_dronecan_work(state: GodState):
    if not state.dronecan_traffic_queues.output_queue.empty():
        envelopes_to_send: typing.List[Envelope] = []
        transport = typing.cast(CANTransport, state.cyphal.local_node.presentation.transport)
        for frame in state.dronecan_traffic_queues.output_queue.queue:
            # This is a dronecan construct
            assert isinstance(frame, dronecan.driver.CANFrame)
            # This is a pycyphal construct
            frame_format: FrameFormat = FrameFormat.EXTENDED if frame.extended else FrameFormat.BASE
            # This is a pycyphal construct
            dataframe: DataFrame = DataFrame(frame_format, frame.id, frame.data)
            # This is a pycyphal construct
            envelopes_to_send.append(Envelope(dataframe, loopback=False))
        await transport.spoof_frames(envelopes_to_send)
