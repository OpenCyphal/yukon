from themes.main_window_theme import get_main_theme


def make_monitor_window(dpg, logger):
    with dpg.window(label="Cyphal monitor", tag="MonitorWindow") as monitor_window_id:
        dpg.add_text("")
        dpg.add_text("Monitoring!")
        with dpg.draw_layer(tag="layer2"):
            dpg.draw_line((10, 60), (100, 160), color=(255, 0, 0, 255), thickness=1)
            dpg.draw_arrow((50, 120), (100, 115), color=(0, 200, 255), thickness=1, size=10)
    return monitor_window_id
