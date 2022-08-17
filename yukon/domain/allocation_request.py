from dataclasses import dataclass

from yukon.domain import HWID


@dataclass
class AllocationRequest:
    received_at: float
    requesting_device_unique_id: HWID
