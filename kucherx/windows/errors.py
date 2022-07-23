import logging

from domain.kucherx_state import KucherXState

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")


def make_errors_window(dpg, state: KucherXState):
    with dpg.window(label="List of errors and messages", width=700, height=400, no_close=False) as current_window_id:
        counter = 0

        def hide_errors():
            """While clearing the items is only possible by making a new window, it is possible to hide the items"""
            for i in range(counter):
                try:
                    dpg.hide_item(f"error{i}")
                except Exception as e:
                    logger.error(e)

        dpg.add_button(label="Hide errors", callback=hide_errors)

        def add_error_to_display(error: str):
            nonlocal counter
            dpg.add_text(default_value=error, tag=f"error{counter}", parent=current_window_id, show=True)
            counter += 1

    return add_error_to_display
