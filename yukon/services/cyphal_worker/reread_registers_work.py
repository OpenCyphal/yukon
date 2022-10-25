import asyncio
import logging

from yukon.domain.reread_registers_request import RereadRegistersRequest
from yukon.domain.god_state import GodState
from yukon.services.snoop_registers import get_register_value

logger = logging.getLogger(__name__)


async def do_reread_registers_work(state: GodState) -> None:
    if not state.queues.reread_registers.empty():
        try:
            request2: RereadRegistersRequest = state.queues.reread_registers.get_nowait()
            for node_id in request2.pairs:
                node_id2 = int(node_id)
                for register_name in request2.pairs[node_id]:
                    asyncio.create_task(get_register_value(state, node_id2, register_name, True))
        except:
            logger.exception("Reread register values failed")
