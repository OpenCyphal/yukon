import typing
from typing import Any

from kucherx.domain.kucherx_state import KucherXState
from kucherx.domain.queue_quit_object import QueueQuitObject


def errors_thread(state: KucherXState) -> None:
    while state.gui_running:
        error = state.errors_queue.get()
        if isinstance(error, QueueQuitObject):
            break
        state.display_errors_callback(error)
