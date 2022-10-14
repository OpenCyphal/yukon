import aiohttp
import time
import logging
import traceback
from multiprocessing import Process
from yukon.__main__ import run_application

logger = logging.getLogger(__name__)


async def create_yukon(attached_with_node_id: int):
    session = aiohttp.ClientSession()
    # First check if there is any other yukon on that port
    is_any_yukon_already_running = True
    try:
        await session.post(
            "http://localhost:5001/api/attach_udp_transport",
            json={"arguments": ["127.0.0.0", "1200", str(attached_with_node_id)]},
            timeout=1.0,
        )
    except aiohttp.ClientConnectionError:
        is_any_yukon_already_running = False
    if is_any_yukon_already_running:
        raise Exception(
            "A Yukon was already running on a testing port at the time when it had to be launched"
        ) from None
    yukon_process = Process(target=run_application, args=(True, 5001, False), daemon=True)
    yukon_process.start()
    time.sleep(10)
    logger.debug("Sending a request to attach transport")
    # Send a request to localhost:5000/api/attach_udp_transport, containing json
    # {"arguments":["127.0.0.0","1200","127"]}
    # and check that the response.success == true
    try:
        response = await session.post(
            "http://localhost:5001/api/attach_udp_transport",
            json={"arguments": ["127.0.0.0", "1200", str(attached_with_node_id)]},
            timeout=3,
        )
    except aiohttp.ClientConnectionError:
        logger.exception("Connection error")
        raise Exception(
            "The test failed to send an attach command to Yukon, API was not available. Connection error.\n"
            f" {traceback.format_exc(chain=False)}"
        ) from None
    if response.status_code != 200:
        raise Exception("Response to the request had a different response code from 200.") from None
    response_json = response.json()
    if not response_json["success"]:
        if "Interface already in use" not in response_json["message"]:
            raise Exception("Failed to attach UDP transport: " + response_json["message"]) from None
        logger.debug("Strangely enough, the UDP transport was already attached.")
    print("The test has successfully attached a UDP transport to Yukon.")
    print("Yukon was launched")
    return yukon_process
