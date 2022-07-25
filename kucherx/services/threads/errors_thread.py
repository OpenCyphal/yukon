import typing
from typing import Any

from kucherx.domain.kucherx_state import KucherXState
from kucherx.domain.queue_quit_object import QueueQuitObject


def errors_thread(state: KucherXState, add_error_to_display: typing.Callable[[str], None]) -> None:
    while state.gui_running:
        error = state.errors_queue.get()
        if isinstance(error, QueueQuitObject):
            break
        add_error_to_display(error)
