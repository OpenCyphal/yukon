import signal


def make_terminate_handler(exit_handler):
    signal.signal(signal.SIGINT, exit_handler)
    signal.signal(signal.SIGTERM, exit_handler)
