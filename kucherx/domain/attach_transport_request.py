from dataclasses import dataclass

from domain.UID import UID
from domain.interface import Interface


@dataclass
class AttachTransportRequest:
    requesting_window_id: UID
    requested_interface: Interface
