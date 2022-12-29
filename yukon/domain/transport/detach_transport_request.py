import typing


class DetachTransportRequest:
    def __init__(self, interface_hash: str) -> None:
        self.interface_hash = interface_hash

    def __str__(self) -> str:
        return "DetachTransportRequest(%s)" % self.interface_hash

    def __repr__(self) -> typing.Any:
        return self.__str__()
