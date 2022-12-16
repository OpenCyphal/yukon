import typing
from dataclasses import dataclass

import pycyphal


@dataclass
class SynchronizedMessageCarrier:
    message: typing.Any
    metadata: pycyphal.transport.TransferFrom
    counter: int
    subject_id: int

    def __hash__(self) -> int:
        return hash((self.message, self.metadata, self.counter))
