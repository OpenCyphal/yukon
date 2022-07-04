def get_main_theme(dpg):
    with dpg.theme() as global_theme:
        with dpg.theme_component(dpg.mvAll):
            # cool color, maybe later?
            # dpg.add_theme_color(dpg.mvThemeCol_FrameBg, (255, 140, 23), category=dpg.mvThemeCat_Core)
            dpg.add_theme_style(dpg.mvStyleVar_WindowPadding, 15, 42, category=dpg.mvThemeCat_Core)
    return global_theme
