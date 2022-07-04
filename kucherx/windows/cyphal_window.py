def make_cyphal_window(dpg, logger, default_font):
    with dpg.window(label="Cyphal window", tag="Primary Window", width=400) as main_window_id:
        logger.warning(f"Main window id is {main_window_id}")
        dpg.bind_font(default_font)
        dpg.add_text("Hello, Cyphal")
        dpg.add_button(label="Save")
        dpg.add_input_text(label="string", default_value="Quick brown fox")
        dpg.add_slider_float(label="float", default_value=0.273, max_value=1)
    return main_window_id
