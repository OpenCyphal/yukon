from themes.main_window_theme import get_main_theme


def make_monitor_window(dpg, logger):
    with dpg.window(label="Cyphal monitor", tag="MonitorWindow") as monitor_window_id:
        dpg.add_text("")
        dpg.add_text("Monitoring!")

    return monitor_window_id
