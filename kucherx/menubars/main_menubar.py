def make_main_menubar(dpg, default_font, new_interface_callback):
    with dpg.viewport_menu_bar():
        dpg.bind_font(default_font)
        dpg.add_button(label="Add interface", callback=new_interface_callback)
