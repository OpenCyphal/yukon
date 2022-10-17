import pathlib


def get_root_folder():
    """Iterates up the directory tree, starting from its parent until it reaches one that contains a setup.cfg file."""
    current_dir = pathlib.Path(__file__).parent
    while not (current_dir / "setup.cfg").exists():
        current_dir = current_dir.parent
    return current_dir
