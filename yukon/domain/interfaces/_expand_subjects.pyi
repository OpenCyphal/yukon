import numpy as np
from _typeshed import Incomplete
from numpy._typing import NDArray as NDArray
from typing import AbstractSet, Any

def expand_subjects(m: Any) -> AbstractSet[int]: ...
def expand_mask(mask: NDArray[np.bool_]) -> AbstractSet[int]: ...

N_NODES: int
N_SUBJECTS: Incomplete
N_SERVICES: Incomplete
