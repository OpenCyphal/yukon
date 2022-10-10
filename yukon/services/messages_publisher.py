import logging
import time

import typing

from yukon.domain.message import Message
from yukon.domain.god_state import GodState


def get_level_no(level_name: str) -> int:
    if level_name == "CRITICAL":
        return 50
    elif level_name == "FATAL":
        return 50
    elif level_name == "ERROR":
        return 40
    elif level_name == "WARNING":
        return 30
    elif level_name == "WARN":
        return 30
    elif level_name == "INFO":
        return 20
    elif level_name == "DEBUG":
        return 10
    elif level_name == "NOTSET":
        return 0
    else:
        return -1


class MessagesPublisher(logging.Handler):
    def __init__(self, state: GodState) -> None:
        super().__init__()
        self._state = state

    def emit(self, record: logging.LogRecord) -> None:
        self._state.queues.message_queue_counter += 1
        if self._state.gui.message_severity:
            if record.levelno < get_level_no(self._state.gui.message_severity):
                return
        new_message = Message(
            record.getMessage(),
            record.created,
            self._state.queues.message_queue_counter,
            False,
            [],
            severity_number=record.levelno,
            severity_text=record.levelname,
        )
        self._state.queues.messages.put(new_message)


def add_local_message(state: GodState, text: str, *args: typing.List[typing.Any]) -> None:
    state.queues.message_queue_counter += 1
    state.queues.messages.put(Message(text, time.monotonic(), state.queues.message_queue_counter, True, arguments=args))
