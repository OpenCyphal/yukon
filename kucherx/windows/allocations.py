import typing

from kucherx.domain import UID
from kucherx.domain.god_state import GodState


def make_allocations_window(dpg: typing.Any, state: GodState) -> UID:
    dpg.bind_font(state.gui.default_font)
    with dpg.window(label="Monitor window", tag="AllocationsWindow") as state.gui.allocations_window:
        dpg.add_text("Available nodes for node-id allocation:")
        
