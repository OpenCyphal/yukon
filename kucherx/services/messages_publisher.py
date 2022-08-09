import logging

from kucherx.domain.god_state import GodState


class MessagesPublisher(logging.Handler):
    def __init__(self, state: GodState) -> None:
        super().__init__()
        self._state = state

    def emit(self, record: logging.LogRecord) -> None:
        print("Yes")
        self._state.queues.messages.put(record.getMessage())
