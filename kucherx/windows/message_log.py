import logging
import typing

from kucherx.domain import UID
from kucherx.domain.god_state import GodState

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")


def make_errors_window(dpg: typing.Any, state: GodState, monitor_window: UID) -> UID:
    with dpg.child_window(label="Log of messages:", parent=state.second_row, show=True) as errors_group_id:
        counter = 0

        def hide_messages() -> None:
            """While clearing the items is only possible by making a new window, it is possible to hide the items"""
            for i in range(counter):
                try:
                    dpg.hide_item(f"error{i}")
                except Exception as e:
                    logger.error(e)

        dpg.add_button(label="Hide messages", callback=hide_messages)

        def add_message_to_display(error: str) -> None:
            nonlocal counter
            dpg.add_text(default_value=error, tag=f"error{counter}", parent=errors_group_id, show=True)
            counter += 1

        state.gui.display_errors_callback = add_message_to_display
    return errors_group_id
