from high_dpi_handler import configure_font_and_scale
from windows.cyphal_window import save_cyphal_local_node_settings


def display_close_popup_viewport(dpg, logger, resources_directory, screen_resolution, save_callback=None,
                                 dont_save_callback=None):
    default_font = configure_font_and_scale(dpg, logger, resources_directory)
    # Calculations for centering the viewport for the popup
    needed_width = 730
    needed_center_x_position = int(screen_resolution[0] / 2 - needed_width / 2)
    needed_height = 300
    needed_center_y_position = int(screen_resolution[1] / 2 - needed_height / 2)
    dpg.create_viewport(title='KucherX is closing', width=needed_width, max_height=needed_height, height=needed_height,
                        x_pos=needed_center_x_position,
                        y_pos=needed_center_y_position,
                        small_icon=str(resources_directory / "icons/png/KucherX.png"),
                        large_icon=str(resources_directory / "icons/png/KucherX_256.ico"),
                        resizable=False)
    dpg.setup_dearpygui()
    # Include the following code before showing the viewport/calling `dearpygui.dearpygui.show_viewport`.

    dpg.show_viewport()
    with dpg.window(label="Before you exit") as primary_window:
        dpg.bind_font(default_font)
        from themes.close_popup_theme import get_close_popup_theme
        dpg.bind_item_theme(primary_window, get_close_popup_theme(dpg))
        dpg.add_text("Do you want to save your Cyphal local node settings?")
        # defining empty callbacks for the case when callbacks weren't provided
        # I don't think they can be just left valued to None
        if save_callback is None:
            def save_callback():
                pass
        if dont_save_callback is None:
            def dont_save_callback():
                pass

        def close_callback():
            dpg.stop_dearpygui()

        with dpg.group() as group_btns:
            with dpg.theme() as theme_group:
                with dpg.theme_component(dpg.mvAll):
                    dpg.add_theme_style(dpg.mvStyleVar_ItemSpacing, 10, 10, category=dpg.mvThemeCat_Core)
            dpg.bind_item_theme(group_btns, theme_group)
            btn_save = dpg.add_button(label="Save", tag="btnSave", width=200)
            btn_dont_save = dpg.add_button(label="Don't save", tag="btnDontSave", width=200)
            primary_window_configuration_size = dpg.get_item_rect_size(primary_window)
            btn_save_size = dpg.get_item_rect_size(btn_save)
            btn_dont_save_size = dpg.get_item_rect_size(btn_dont_save)
            dpg.configure_item(group_btns, pos=(240, 80))
        dpg.set_item_callback("btnDontSave", dont_save_callback)
        dpg.set_item_callback("btnSave", save_callback)

        dpg.set_item_callback("btnSave", close_callback)
        dpg.set_item_callback("btnDontSave", close_callback)
    dpg.set_primary_window(primary_window, True)
    dpg.start_dearpygui()
