from typing import AbstractSet

class PortSet:
    pub: AbstractSet[int]
    sub: AbstractSet[int]
    cln: AbstractSet[int]
    srv: AbstractSet[int]
    def __init__(self, pub, sub, cln, srv) -> None: ...
