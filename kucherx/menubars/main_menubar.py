import typing

from kucherx.domain.UID import UID


def make_main_menubar(dpg: typing.Any, default_font: UID, new_interface_callback: typing.Callable[[None], None]) -> UID:
    with dpg.viewport_menu_bar() as menu_bar_id:
        dpg.bind_font(default_font)
        dpg.add_button(label="Add interface", callback=new_interface_callback)
    return menu_bar_id
