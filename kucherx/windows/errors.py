import logging
import typing

from kucherx.domain import UID
from kucherx.domain.kucherx_state import KucherXState

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")


def make_errors_window(dpg: typing.Any, state: KucherXState, monitor_window: UID) -> UID:
    with dpg.child_window(label="List of errors and messages", parent=state.second_row, show=True) as errors_group_id:
        counter = 0

        def hide_errors() -> None:
            """While clearing the items is only possible by making a new window, it is possible to hide the items"""
            for i in range(counter):
                try:
                    dpg.hide_item(f"error{i}")
                except Exception as e:
                    logger.error(e)

        dpg.add_button(label="Hide errors", callback=hide_errors)

        def add_error_to_display(error: str) -> None:
            nonlocal counter
            dpg.add_text(default_value=error, tag=f"error{counter}", parent=errors_group_id, show=True)
            counter += 1

        state.display_errors_callback = add_error_to_display
    return errors_group_id
