import asyncio
import logging

from pycyphal.application import make_node, NodeInfo

from yukon.services.cyphal_worker.detach_transport_work import do_detach_transport_work
from yukon.services.cyphal_worker.subscribe_requests_work import do_subscribe_requests_work
from yukon.services.cyphal_worker.reread_register_names_work import do_reread_register_names_work
from yukon.services.cyphal_worker.reread_registers_work import do_reread_registers_work
from yukon.services.cyphal_worker.send_command_work import do_send_command_work
from yukon.services.cyphal_worker.attach_transport_work import do_attach_transport_work
from yukon.services.cyphal_worker.update_configuration_work import do_apply_configuration_work
from yukon.services.cyphal_worker.update_register_work import do_update_register_work
from yukon.domain.god_state import GodState
from yukon.services.snoop_registers import make_tracers_trackers

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")


def cyphal_worker(state: GodState) -> None:
    """It starts the node and keeps adding any transports that are queued for adding"""

    async def _internal_method() -> None:
        try:
            state.cyphal.local_node = make_node(
                NodeInfo(name="com.zubax.sapog.tests.debugger"), reconfigurable_transport=True
            )
            state.cyphal.local_node.start()
            state.cyphal.local_node.registry["uavcan.node.id"] = 13
            state.cyphal.pseudo_transport = state.cyphal.local_node.presentation.transport
            make_tracers_trackers(state)
            print("Tracers should have been set up.")
            while state.gui.gui_running:
                await asyncio.sleep(0.05)
                await do_attach_transport_work(state)
                await asyncio.sleep(0.02)
                await do_detach_transport_work(state)
                await asyncio.sleep(0.02)
                await do_subscribe_requests_work(state)
                await asyncio.sleep(0.02)
                await do_update_register_work(state)
                await asyncio.sleep(0.02)
                await do_apply_configuration_work(state)
                await asyncio.sleep(0.02)
                await do_send_command_work(state)
                await asyncio.sleep(0.02)
                await do_reread_registers_work(state)
                await asyncio.sleep(0.02)
                await do_reread_register_names_work(state)
        except Exception as e:
            logger.exception(e)
            raise e

    asyncio.run(_internal_method())
