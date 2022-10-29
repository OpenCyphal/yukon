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


def get_level_name(level_no: int) -> str:
    if level_no == 50:
        return "CRITICAL"
    elif level_no == 40:
        return "ERROR"
    elif level_no == 30:
        return "WARNING"
    elif level_no == 20:
        return "INFO"
    elif level_no == 10:
        return "DEBUG"
    elif level_no == 0:
        return "NOTSET"
    else:
        return "UNKNOWN"


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
            severity_number=record.levelno,
            severity_text=record.levelname,
            module=record.module,
        )
        self._state.queues.messages.put(new_message)


def add_local_message(state: GodState, text: str, severity: int, *args: typing.List[typing.Any]) -> None:
    state.queues.message_queue_counter += 1
    state.queues.messages.put(
        Message(
            text, time.monotonic(), state.queues.message_queue_counter, severity, get_level_name(severity), __name__
        )
    )
