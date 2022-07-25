from dataclasses import dataclass

from kucherx.domain.UID import UID
from kucherx.domain.interface import Interface


@dataclass
class AttachTransportRequest:
    requesting_window_id: UID
    requested_interface: Interface
