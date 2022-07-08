from themes.main_window_theme import get_main_theme


def make_monitor_window(dpg, logger):
    with dpg.window(label="Cyphal monitor", tag="MonitorWindow") as monitor_window_id:
        logger.info("Monitor window id is " + monitor_window_id)
        dpg.bind_item_theme(monitor_window_id, get_main_theme(dpg))

        def switch_to_local_node_settings():
            dpg.hide_item(monitor_window_id)
            dpg.show_item("CyphalConfig")
            dpg.set_primary_window("CyphalConfig", True)

        dpg.add_button(label="Switch to local node settings", callback=switch_to_local_node_settings)
        dpg.add_text("Hello!")

    return monitor_window_id
