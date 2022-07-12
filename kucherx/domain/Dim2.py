from dataclasses import dataclass

from domain.Dim import Dim


@dataclass
class Dim2:
    x: Dim
    y: Dim
