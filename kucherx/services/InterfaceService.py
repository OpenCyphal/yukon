from pycyphal.application import Node
from pycyphal.transport import Transport

from domain.KucherXState import KucherXState
from domain.UID import UID


def interface_added(state: KucherXState, coming_from_id: UID, transport: Transport):
    state.pseudo_transport.attach_inferior(transport)
