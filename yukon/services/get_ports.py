import logging
import subprocess
import typing

from serial.tools.list_ports_common import ListPortInfo
from serial.tools import list_ports
import platform

logger = logging.getLogger(__name__)


def ListPortInfo_to_dict(list_port_info: ListPortInfo) -> typing.Any:
    return {
        "device": list_port_info.device,
        "description": list_port_info.description,
        "hwid": list_port_info.hwid,
        "product": list_port_info.product,
        "product_id": list_port_info.pid,
        "serial_number": list_port_info.serial_number,
        "manufacturer": list_port_info.manufacturer,
        "interface": list_port_info.interface,
        "usb_description": list_port_info.usb_description(),
    }


def get_slcan_ports() -> typing.List[typing.Any]:
    return list(map(ListPortInfo_to_dict, list_ports.comports()))


# This function is from socketcan/utils.py
def find_available_interfaces() -> typing.Iterable[str]:
    """Returns the names of all open can/vcan interfaces using
    the ``ip link list`` command. If the lookup fails, an error
    is logged to the console and an empty list is returned.
    """

    try:
        # adding "type vcan" would exclude physical can devices
        command = ["ip", "-o", "link", "list", "up"]
        output = subprocess.check_output(command, universal_newlines=True)

    except Exception as e:  # subprocess.CalledProcessError is too specific
        logger.error("failed to fetch opened can devices: %s", e)
        return []

    else:
        # log.debug("find_available_interfaces(): output=\n%s", output)
        # output contains some lines like "1: vcan42: <NOARP,UP,LOWER_UP> ..."
        # extract the "vcan42" of each line
        output_lines = output.splitlines()
        interface_names = [line.split(": ", 3)[1] for line in output_lines]
        logger.debug(
            "find_available_interfaces(): detected these interfaces (before filtering): %s",
            interface_names,
        )
        matching_interfaces = []
        for index, output_line in enumerate(output_lines):
            if "link/can" in output_line:
                matching_interfaces.append(interface_names[index])
        return matching_interfaces


def get_socketcan_ports() -> typing.List[str]:
    # If is Linux then
    if platform.system() == "Linux":
        # from can.interfaces.socketcan import utils as socketcan_utils
        interfaces_list = list(find_available_interfaces())
        return interfaces_list
    else:
        return []
