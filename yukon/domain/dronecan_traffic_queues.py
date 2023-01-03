from dataclasses import dataclass, field
from asyncio import Queue
from queue import Queue as NormalQueue

from dronecan.driver import CANFrame


@dataclass
class DroneCanTrafficQueues:
    input_queue: NormalQueue[CANFrame] = field(default_factory=NormalQueue)
    output_queue: Queue[CANFrame] = field(default_factory=Queue)
