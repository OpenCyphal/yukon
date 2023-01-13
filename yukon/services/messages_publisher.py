import datetime
import logging
import os

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


def log_message(state: "yukon.domain.god_state.GodState", new_message: str) -> None:
    # Check if the directory .yukon exists in the home directory, if it doesn't then create it
    if not os.path.exists(os.path.join(os.path.expanduser("~"), ".yukon")):
        os.mkdir(os.path.join(os.path.expanduser("~"), ".yukon"))
    # Check if state.log_file is set, if it is then write the message to the log file
    if not state.log_file:
        state.log_file = (
            os.path.join(
                os.path.expanduser("~"), ".yukon", "yukon-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
            )
            + ".log"
        )
    with open(state.log_file, "a", encoding="utf-8") as log_file:
        log_file.write(new_message)


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
        log_message(self._state, str(new_message).strip() + os.linesep)
        self._state.queues.messages.put(new_message)


def add_local_message(state: "yukon.domain.god_state.GodState", text: str, severity: int, name: str = __name__) -> None:
    state.queues.message_queue_counter += 1
    new_message = Message(
        text,
        datetime.datetime.now().strftime(TIME_FORMAT),
        state.queues.message_queue_counter,
        severity,
        get_level_name(severity),
        name or "unknown",
    )
    state.queues.messages.put(new_message)
    log_message(state, str(new_message).strip() + os.linesep)
