import logging
import time

from yukon.domain.message import Message
from yukon.domain.god_state import GodState


class MessagesPublisher(logging.Handler):
    def __init__(self, state: GodState) -> None:
        super().__init__()
        self._state = state

    def emit(self, record: logging.LogRecord) -> None:
        self._state.queues.message_queue_counter += 1
        new_message = Message(record.getMessage(), record.created, self._state.queues.message_queue_counter)
        self._state.queues.messages.put(new_message)


def add_local_message(state, text, *args):
    state.queues.message_queue_counter += 1
    state.queues.messages.put(Message(text, time.monotonic(), state.queues.message_queue_counter, True, arguments=args))
