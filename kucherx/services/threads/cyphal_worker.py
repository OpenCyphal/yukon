import asyncio
import logging
from queue import Empty

from pycyphal.application import make_node, NodeInfo, make_transport
from pycyphal.transport.can import CANTransport
from pycyphal.transport.can.media.pythoncan import PythonCANMedia

from kucherx.domain.attach_transport_request import AttachTransportRequest
from kucherx.domain.god_state import GodState
from kucherx.services.make_tracers_trackers import make_tracers_trackers

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")


def cyphal_worker_thread(state: GodState) -> None:
    """It starts the node and keeps adding any transports that are queued for adding"""

    async def _internal_method() -> None:
        state.cyphal.local_node = make_node(
            NodeInfo(name="com.zubax.sapog.tests.debugger"),
            reconfigurable_transport=True)
        state.cyphal.local_node.start()
        state.pseudo_transport = state.cyphal.local_node.presentation.transport
        make_tracers_trackers(state)
        print("Tracers should have been set up.")
        while state.gui.gui_running:
            try:
                await asyncio.sleep(0.05)
                atr: AttachTransportRequest = state.queues.add_transport.get_nowait()
                new_transport = make_transport(atr.get_registers(), reconfigurable=True)
                state.cyphal.pseudo_transport.attach_inferior(new_transport)
                state.queues.messages.put(f"Interface {atr.requested_interface} was added.")
                print("Added a new interface")
            except Empty:
                await asyncio.sleep(0.05)
                try:
                    transport = state.queues.detach_transports.get_nowait()
                    state.cyphal.pseudo_transport.detach_inferior(transport)
                except Empty:
                    pass
                except Exception as e:
                    logger.error(e)
            except Exception as e:
                logger.error(e)

    asyncio.run(_internal_method())
