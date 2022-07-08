import pathlib
import time

from themes.main_window_theme import get_main_theme


def get_root_directory():
    from os.path import exists
    current = pathlib.Path(__file__).parent
    time_started = time.time()
    while time_started - time.time() < 0.1:
        if exists(current / "LICENSE") or exists(current / ".gitignore"):
            return current.resolve()
        else:
            current = current.parent
    return None


def make_monitor_window(dpg, logger):
    with dpg.window(label="Cyphal monitor", tag="MonitorWindow") as monitor_window_id:
        logger.info("Monitor window id is " + monitor_window_id)
        dpg.bind_item_theme(monitor_window_id, get_main_theme(dpg))

        def switch_to_local_node_settings():
            dpg.hide_item(monitor_window_id)
            dpg.show_item("CyphalConfig")
            dpg.set_primary_window("CyphalConfig", True)

        with dpg.texture_registry(show=False):
            width, height, channels, data = dpg.load_image(
                str((get_root_directory() / "kucherx/res/icons/png/settings_32.png").resolve()))
            dpg.add_static_texture(width=width, height=height, default_value=data, tag="settings_image")
        dpg.add_image_button(label="Switch to local node settings", callback=switch_to_local_node_settings,
                             texture_tag="settings_image", tag="switch_to_settings")
        with dpg.theme() as tooltip_theme:
            with dpg.theme_component(dpg.mvAll):
                dpg.add_theme_style(dpg.mvStyleVar_WindowPadding, 0, 0, category=dpg.mvThemeCat_Core)
                dpg.add_theme_style(dpg.mvStyleVar_FramePadding, 0, 0, category=dpg.mvThemeCat_Core)
        with dpg.tooltip("switch_to_settings") as tooltip1:
            dpg.bind_item_theme(tooltip1, tooltip_theme)
            text_label = dpg.add_text("Local node settings")
            dpg.bind_item_theme(text_label, tooltip_theme)
        dpg.add_text("Hello!")

    return monitor_window_id
