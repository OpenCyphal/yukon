import asyncio
import logging
import traceback

from yukon.domain.reread_registers_request import RereadRegistersRequest
from yukon.domain.god_state import GodState
from yukon.services.snoop_registers import get_register_value

logger = logging.getLogger(__name__)

logger.setLevel(logging.DEBUG)


async def do_reread_registers_work(state: GodState, request2: RereadRegistersRequest) -> None:
    logger.debug("request2 in do_reread_registers_work: %r", request2)
    try:
        for node_id in request2.pairs:
            node_id2 = int(node_id)
            for register_name in request2.pairs[node_id]:
                asyncio.create_task(get_register_value(state, node_id2, register_name, True))
    except:
        tb = traceback.format_exc()
        logger.exception("Reread register values failed")
        logger.critical(tb)
