import typing
from dataclasses import dataclass

import pycyphal


@dataclass
class MessageCarrier:
    message: typing.Any
    metadata: pycyphal.transport.TransferFrom
    counter: int

    def __hash__(self) -> int:
        return hash((self.message, self.metadata, self.counter))
