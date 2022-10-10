import typing

from serial.tools.list_ports_common import ListPortInfo
from serial.tools import list_ports
import platform


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
    }


def get_slcan_ports() -> typing.List[typing.Any]:
    return list(map(ListPortInfo_to_dict, list_ports.comports()))


def get_socketcan_ports() -> typing.List[str]:
    # If is Linux then
    if platform.system() == "Linux":
        from can.interfaces.socketcan import utils as socketcan_utils

        return list(socketcan_utils.find_available_interfaces())
    else:
        return []
