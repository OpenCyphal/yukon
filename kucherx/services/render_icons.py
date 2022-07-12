from services.folder_recognition.get_common_folders import *


def prepare_rendered_icons(logger):
    from os import walk
    try:
        import cairosvg
        svg_files = []
        for (dir_path, dir_names, filenames) in walk(get_resources_directory() / "icons" / "svg"):
            for file_name in filenames:
                if ".svg" in file_name:
                    svg_files.append(file_name)
            break
    except Exception as e:
        if type(e) == OSError and "no library called \"cairo-2\" was found" in repr(e):
            logger.error("Was unable to find the cairo-2 dlls. This means that I am unable to convert SVG icons to "
                         "PNG for display.")
            return
        else:
            raise e
