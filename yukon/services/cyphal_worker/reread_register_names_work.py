import asyncio
import logging
import traceback

from yukon.domain.registers.reread_register_names_request import RereadRegisterNamesRequest
from yukon.services.snoop_registers import get_register_names
from yukon.domain.god_state import GodState

logger = logging.getLogger(__name__)


async def do_reread_register_names_work(state: GodState, names_request: RereadRegisterNamesRequest) -> None:
    try:
        asyncio.create_task(
            get_register_names(
                state,
                names_request.node_id,
                state.avatar.avatars_by_node_id[names_request.node_id],
                True,
            )
        )
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(tb)
