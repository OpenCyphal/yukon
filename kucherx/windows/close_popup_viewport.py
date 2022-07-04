from high_dpi_handler import configure_font_and_scale


def display_close_popup_viewport(dpg, logger, resources_directory, screen_resolution):
    dpg.create_context()
    default_font = configure_font_and_scale(dpg, logger, resources_directory)
    # Calculations for centering the viewport for the popup
    needed_width = 700
    needed_center_x_position = int(screen_resolution[0] / 2 - needed_width / 2)
    needed_height = 100
    needed_center_y_position = int(screen_resolution[1] / 2 - needed_height / 2)
    dpg.create_viewport(title='KucherX', width=needed_width, max_height=needed_height, height=needed_height,
                        x_pos=needed_center_x_position,
                        y_pos=needed_center_y_position,
                        small_icon=str(resources_directory / "icons/png/KucherX.png"),
                        large_icon=str(resources_directory / "icons/png/KucherX_256.ico"))
    dpg.setup_dearpygui()
    # Include the following code before showing the viewport/calling `dearpygui.dearpygui.show_viewport`.

    dpg.show_viewport()
    with dpg.window(label="Before you exit") as primary_window:
        dpg.bind_font(default_font)
        dpg.add_text("Do you want to save your Cyphal local node settings?")
        dpg.add_button(label="Save")
        dpg.add_button(label="Don't save")
    dpg.set_primary_window(primary_window, True)
    dpg.start_dearpygui()

    dpg.destroy_context()
