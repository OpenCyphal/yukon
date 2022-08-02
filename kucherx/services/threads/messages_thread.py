import typing
from queue import Empty
from typing import Any

from kucherx.domain.god_state import GodState
from kucherx.domain.queue_quit_object import QueueQuitObject


def messages_thread(state: GodState) -> None:
    while state.gui.gui_running:
        if not state.queues.messages.empty():
            message = state.queues.messages.get_nowait()
            if isinstance(message, QueueQuitObject):
                break
            state.gui.display_errors_callback(message)
        if not state.queues.transport_successfully_added_messages.empty():
            message = state.queues.transport_successfully_added_messages.get_nowait()
            state.gui.display_errors_callback("Connected: " + message)
