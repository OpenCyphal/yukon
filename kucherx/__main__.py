import asyncio

if __name__ == "__main__":
    from main import main

    try:
        asyncio.run(main())  # pylint: disable=no-value-for-parameter
    except KeyboardInterrupt:
        print("KucherX is closing.")
