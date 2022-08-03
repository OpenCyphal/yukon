from kucherx.domain import HWID
from kucherx.domain.god_state import GodState


def get_avatar_from_id(state: GodState, _id: HWID):
    return state.avatar.avatars_by_hw_id.get(_id)
