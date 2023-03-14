import asyncio
import signal

import websockets


async def echo(websocket):
    async for message in websocket:
        await websocket.send(message)

async def run_server():
    loop = asyncio.get_running_loop()
    stop = loop.create_future()
    loop.add_signal_handler(signal.SIGTERM, stop.set_result, None)
    async with websockets.serve(echo, "127.0.0.1", 8001):
        await asyncio.Future()

def __main__():
    if __name__ == "__main__":
        