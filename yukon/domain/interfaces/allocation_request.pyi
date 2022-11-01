from yukon.domain.interfaces import HWID as HWID


class AllocationRequest:
    received_at: float
    requesting_device_unique_id: HWID

    def __init__(self, received_at, requesting_device_unique_id) -> None: ...
