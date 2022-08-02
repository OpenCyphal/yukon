import typing
from typing import Any

from kucherx.domain.god_state import GodState
from kucherx.domain.queue_quit_object import QueueQuitObject


def errors_thread(state: GodState) -> None:
    while state.gui.gui_running:
        error = state.queues.messages_queue.get()
        if isinstance(error, QueueQuitObject):
            break
        state.gui.display_errors_callback(error)
