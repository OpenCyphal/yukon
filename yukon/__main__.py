import asyncio
import logging
from time import sleep

# import can.interfaces.slcan  # pylint: disable=unused-import

if __name__ == "__main__":
    try:
        from yukon.main import main
    except Exception:
        logging.getLogger().exception("Failed to import main")
        while True:
            sleep(1)

    try:
        asyncio.run(main())  # pylint: disable=no-value-for-parameter
    except KeyboardInterrupt:
        print("KucherX is closing.")
