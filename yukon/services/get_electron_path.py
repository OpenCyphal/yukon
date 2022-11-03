import sys
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


def get_electron_path() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        root_path = Path(sys._MEIPASS).absolute() / "yukon"  # type: ignore # pylint: disable=protected-access
    else:
        logger.debug("running in a normal Python process")
        root_path = Path(__file__).absolute().parent.parent

    # if platform is windows
    dir_name = "electron"
    if not (getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")):
        dir_name = ".electron"
    extension = ""
    if sys.platform == "win32":
        extension = ".exe"
    return (root_path.parent / dir_name / ("electron" + extension)).absolute()
