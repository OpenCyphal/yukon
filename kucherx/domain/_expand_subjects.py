# Copyright (c) 2021 OpenCyphal
# This software is distributed under the terms of the MIT License.
# Author: Pavel Kirienko <pavel@opencyphal.org>
from typing import AbstractSet, Any

import numpy as np
from numpy._typing import NDArray
from pycyphal.transport import MessageDataSpecifier, ServiceDataSpecifier

import uavcan


def expand_subjects(m: Any) -> AbstractSet[int]:  # Any here is uavcan.node.port.SubjectIDList_0_1
    if m.sparse_list is not None:
        return frozenset(int(x.value) for x in m.sparse_list)
    if m.mask:
        return expand_mask(m.mask)
    if m.total:
        return _COMPLETE_SUBJECT_SET
    assert False


def expand_mask(mask: NDArray[np.bool_]) -> AbstractSet[int]:
    return frozenset(x for x in range(len(mask)) if mask[x])


N_NODES = 65535  # The theoretical limit for all kinds of transports.
N_SUBJECTS = MessageDataSpecifier.SUBJECT_ID_MASK + 1
N_SERVICES = ServiceDataSpecifier.SERVICE_ID_MASK + 1

_COMPLETE_SUBJECT_SET = frozenset(range(N_SUBJECTS))
"""Made static for performance reasons."""
