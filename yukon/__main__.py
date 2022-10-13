import asyncio
import logging
from typing import Optional


def run_application(is_headless: bool, port: Optional[int] = None):
    from yukon.main import main

    logging.basicConfig(level=logging.DEBUG)
    try:
        asyncio.run(main(is_headless, port), debug=True)  # pylint: disable=no-value-for-parameter
    except KeyboardInterrupt:
        print("Yukon is closing.")


if __name__ == "__main__":
    run_application(False)
