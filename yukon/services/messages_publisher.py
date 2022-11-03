import datetime
import logging

import typing

import yukon
from yukon.domain.message import Message


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


TIME_FORMAT = "%y-%m-%d %H:%M:%S"


class MessagesPublisher(logging.Handler):
    def __init__(self, state: "yukon.domain.god_state.GodState") -> None:
        super().__init__()
        self._state = state

    def emit(self, record: logging.LogRecord) -> None:
        self._state.queues.message_queue_counter += 1
        if self._state.gui.message_severity:
            if record.levelno < get_level_no(self._state.gui.message_severity):
                return
        new_message = Message(
            record.getMessage(),
            datetime.datetime.fromtimestamp(record.created).strftime(TIME_FORMAT),
            self._state.queues.message_queue_counter,
            severity_number=record.levelno,
            severity_text=record.levelname,
            module=record.name,
        )
        self._state.queues.messages.put(new_message)


def add_local_message(
        state: "yukon.domain.god_state.GodState", text: str, severity: int, *args: typing.List[typing.Any]
) -> None:
    state.queues.message_queue_counter += 1
    state.queues.messages.put(
        Message(
            text,
            datetime.datetime.now().strftime(TIME_FORMAT),
            state.queues.message_queue_counter,
            severity,
            get_level_name(severity),
            __name__,
        )
    )
