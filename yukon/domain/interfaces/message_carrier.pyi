import pycyphal
import typing

class MessageCarrier:
    message: typing.Any
    metadata: pycyphal.transport.TransferFrom
    counter: int
    def __hash__(self) -> int: ...
    def __init__(self, message, metadata, counter) -> None: ...
