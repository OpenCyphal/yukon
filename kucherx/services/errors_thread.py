from domain.kucherx_state import KucherXState
from domain.queue_quit_object import QueueQuitObject


def _errors_thread(state: KucherXState, add_error_to_display):
    while state.gui_running:
        error = state.errors_queue.get()
        if isinstance(error, QueueQuitObject):
            break
        add_error_to_display(error)
