import logging

from domain.kucherx_state import KucherXState

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")


def make_errors_window(dpg, state: KucherXState):
    with dpg.window(label="Configure interface", width=700, height=400, no_close=False) as current_window_id:
        counter = 0

        def add_error_to_display(error: str):
            nonlocal counter
            dpg.add_text(default_value=error, tag=f"error{counter}", parent=current_window_id, show=True)
            counter += 1

    return add_error_to_display
