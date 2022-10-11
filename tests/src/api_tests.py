import logging

logger = logging.getLogger(__name__)

def test_get_socketcan_ports():
    """Send an api request to localhost:5000/api/get_socketcan_ports and check the response"""
    import requests
    import json

    response = requests.post("http://localhost:5000/api/get_socketcan_ports")
    if response.status_code != 200:
        return False
    try:
        response_ports = json.loads(response.text)
    except json.decoder.JSONDecodeError:
        return False
    ports_array = response_ports.get("ports")
    logger.debug("ports_array: %s", ports_array)
    if not ports_array:
        return False
    return True