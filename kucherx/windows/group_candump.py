import typing

from kucherx.domain.god_state import GodState
from kucherx.domain.interface import Interface
from kucherx.domain import UID
from kucherx.services.folder_recognition.common_folders import get_root_directory


def make_candump_group(dpg, input_field_width, current_window_id: UID, interface: Interface, state: GodState):
    with dpg.group(horizontal=False) as candump_group:
        def get_candump_files() -> typing.List[str]:
            from os import listdir
            from os.path import isfile, join
            root_dir = get_root_directory()
            return [f for f in listdir(root_dir) if isfile(join(root_dir, f)) and ".candump" in f]

        dpg.add_text("Candump path")
        candump_files_select_combobox = None
        tb_candump_path = dpg.add_input_text(default_value="candump:path", width=input_field_width)

        def file_selected(sender: UID, file_name: str) -> None:
            dpg.configure_item(current_window_id, label=file_name)
            interface.iface = "slcan:" + str(file_name).split()[0]

        candump_files_select_combobox = dpg.add_combo(
            default_value="Search not performed",
            width=input_field_width,
            callback=file_selected,
            items=get_candump_files(),
        )

        def use_combobox() -> None:
            """The user can select to see candump files located around the KucherX executable."""
            dpg.hide_item(tb_candump_path)
            dpg.show_item(candump_files_select_combobox)
            items = get_candump_files()
            dpg.configure_item(candump_files_select_combobox, default_value=f"{len(items)} files found.")
            dpg.configure_item(candump_files_select_combobox, items=items)

        def use_textbox() -> None:
            """The user can select to use just a text as the path to a candump file."""
            dpg.hide_item(candump_files_select_combobox)
            dpg.show_item(tb_candump_path)

        with dpg.group(horizontal=False) as combobox_action_group:
            dpg.add_button(label="Look for .candump files around KucherX", callback=use_combobox)
            dpg.add_button(label="Just type paste in the path of a candump", callback=use_textbox)

        dpg.hide_item(candump_files_select_combobox)
        dpg.show_item(tb_candump_path)
    return candump_group
