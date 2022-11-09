from queue import Queue

from dronecan.driver import CANFrame


class DroneCanTrafficQueues:
    input_queue: Queue[CANFrame]
    output_queue: Queue[CANFrame]
