import asyncio
import logging
from queue import Empty

from pycyphal.application import make_node, NodeInfo
from pycyphal.transport.can import CANTransport
from pycyphal.transport.can.media.pythoncan import PythonCANMedia

from kucherx.domain.god_state import GodState
from kucherx.services.make_tracers_trackers import make_tracers_trackers

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")


def cyphal_worker_thread(state: GodState) -> None:
    """It starts the node and keeps adding any transports that are queued for adding"""

    async def _internal_method() -> None:
        state.local_node = make_node(NodeInfo(name="com.zubax.sapog.tests.debugger"), reconfigurable_transport=True)
        state.local_node.start()
        state.pseudo_transport = state.local_node.presentation.transport
        make_tracers_trackers(state)
        print("Tracers should have been set up.")
        while state.gui_running:
            try:
                await asyncio.sleep(0.05)
                interface = state.queue_add_transports.get_nowait()
                new_media = PythonCANMedia(
                    interface.iface,
                    (interface.rate_arb, interface.rate_data),
                    interface.mtu,
                )
                new_transport = CANTransport(media=new_media, local_node_id=state.local_node.id)
                state.pseudo_transport.attach_inferior(new_transport)
                state.messages_queue.put(f"Interface {interface.iface} was added.")
                print("Added a new interface")
            except Empty:
                await asyncio.sleep(0.05)
                try:
                    transport = state.queue_detach_transports.get_nowait()
                    state.pseudo_transport.detach_inferior(transport)
                except Empty:
                    pass
                except Exception as e:
                    logger.error(e)
            except Exception as e:
                logger.error(e)

    asyncio.run(_internal_method())
