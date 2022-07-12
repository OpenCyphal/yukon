from domain.UID import UID


def ensure_window_is_in_viewport(dpg, window_id: UID):
    window_x_pos = dpg.get_item_pos(window_id)[0]
    window_y_pos = dpg.get_item_pos(window_id)[1]
    if window_x_pos < 0:
        # dpg.configure_item(window_id, no_move=True)
        dpg.set_item_pos(window_id, [0, window_y_pos])
