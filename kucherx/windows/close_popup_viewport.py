from high_dpi_handler import configure_font_and_scale


def display_close_popup_viewport(dpg, logger, resources_directory):

    dpg.create_context()
    default_font = configure_font_and_scale(dpg, logger, resources_directory)
    dpg.create_viewport(title='KucherX', width=700, max_height=60,
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
