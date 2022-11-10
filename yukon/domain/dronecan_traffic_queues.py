from dataclasses import dataclass, field
from queue import Queue

from dronecan.driver import CANFrame


@dataclass
class DroneCanTrafficQueues:
    input_queue: Queue[CANFrame] = field(default_factory=Queue)
    output_queue: Queue[CANFrame] = field(default_factory=Queue)
