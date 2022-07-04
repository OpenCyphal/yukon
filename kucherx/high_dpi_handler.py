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
            logger.warning("E_ACCESSDENIED. The DPI awareness is already set, either by calling this API previously"
                           " or through the application (.exe) manifest. ")


def is_high_dpi_screen(logger):
    make_process_dpi_aware(logger)
    try:
        import tkinter
        root = tkinter.Tk()
        dpi = root.winfo_fpixels('1i')
        logger.warning("DPI is " + str(dpi) + " on screen " + root.winfo_screen())
        return dpi > 100
    except ImportError as e:
        logger.warn("Unable to import TKinter, it is missing from Python. Can't tell if the screen is high dpi.")
        return False
