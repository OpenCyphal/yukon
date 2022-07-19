from dataclasses import dataclass

from domain.dim import Dim


@dataclass
class Dim2:
    x: Dim
    y: Dim
