import asyncio
import logging

if __name__ == "__main__":
    from yukon.main import main

    logging.basicConfig(level=logging.DEBUG)
    try:
        asyncio.run(main(), debug=True)  # pylint: disable=no-value-for-parameter
    except KeyboardInterrupt:
        print("Yukon is closing.")
