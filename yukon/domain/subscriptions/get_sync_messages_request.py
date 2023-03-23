from dataclasses import dataclass
import typing


@dataclass
class GetSyncMessagesRequest:
    specifiers_object: typing.Any
    count: int
