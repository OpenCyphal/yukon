import typing
from yukon.domain.interfaces.message_carrier import MessageCarrier as MessageCarrier


class MessagesStore:
    messages: typing.List[MessageCarrier]
    counter: int

    def __hash__(self) -> int: ...

    def __init__(self, messages, counter) -> None: ...
