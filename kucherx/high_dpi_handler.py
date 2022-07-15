def make_process_dpi_aware(logger):
    import ctypes

    try:
        result = ctypes.windll.shcore.SetProcessDpiAwareness(2)  # if your windows version >= 8.1
    except:
        result = ctypes.windll.user32.SetProcessDPIAware()  # win 8.0 or less
    # https://docs.microsoft.com/en-us/windows/win32/api/shellscalingapi/nf-shellscalingapi-setprocessdpiawareness
    match result:
        case None:
            logger.warning("DPI awareness did not have a return value")
        case 0:
            logger.warning("DPI awareness set successfully")
        case 1:
            logger.warning("The value passed in for DPI awareness is not valid.")
        case 2:
            logger.warning(
                "E_ACCESSDENIED. The DPI awareness is already set, either by calling this API previously"
                " or through the application (.exe) manifest. "
            )


def is_high_dpi_screen(logger):
    make_process_dpi_aware(logger)
    try:
        import tkinter

        root = tkinter.Tk()
        dpi = root.winfo_fpixels("1i")
        logger.warning("DPI is " + str(dpi) + " on screen " + root.winfo_screen())
        return dpi > 100
    except ImportError as e:
        logger.warn("Unable to import TKinter, it is missing from Python. Can't tell if the screen is high dpi.")
        return False


def configure_font_and_scale(dpg, logger, resources):
    desired_font_size = 20

    if is_high_dpi_screen(logger):
        dpg.set_global_font_scale(0.8)
        desired_font_size = 40

    # add a font registry
    with dpg.font_registry():
        # first argument ids the path to the .ttf or .otf file
        default_font = dpg.add_font(file=resources / "Roboto/Roboto-Regular.ttf", size=desired_font_size)
    return default_font
