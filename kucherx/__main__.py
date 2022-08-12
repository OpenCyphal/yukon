import asyncio
import can.interfaces.slcan
if __name__ == "__main__":
    from kucherx.main import main

    try:
        asyncio.run(main())  # pylint: disable=no-value-for-parameter
    except KeyboardInterrupt:
        print("KucherX is closing.")
