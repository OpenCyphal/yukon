# Copyright (c) 2021 OpenCyphal
# This software is distributed under the terms of the MIT License.
# Author: Pavel Kirienko <pavel@opencyphal.org>
import dataclasses
from typing import AbstractSet


@dataclasses.dataclass()
class PortSet:
    pub: AbstractSet[int] = dataclasses.field(default_factory=frozenset)
    sub: AbstractSet[int] = dataclasses.field(default_factory=frozenset)
    cln: AbstractSet[int] = dataclasses.field(default_factory=frozenset)
    srv: AbstractSet[int] = dataclasses.field(default_factory=frozenset)
