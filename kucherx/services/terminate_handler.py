import signal
from typing import Callable, Any


def make_terminate_handler(exit_handler: Callable[[Any, Any], None]) -> None:
    signal.signal(signal.SIGINT, exit_handler)
    signal.signal(signal.SIGTERM, exit_handler)
