import asyncio
import logging
import traceback

from pycyphal.application import make_node, NodeInfo, make_transport

from kucherx.domain.attach_transport_request import AttachTransportRequest
from kucherx.domain.attach_transport_response import AttachTransportResponse
from kucherx.domain.god_state import GodState
from kucherx.services.make_tracers_trackers import make_tracers_trackers
from kucherx.services.get_allocatable_nodes import start_listening_for_allocatable_nodes

logger = logging.getLogger(__name__)
logger.setLevel("NOTSET")


def cyphal_worker_thread(state: GodState) -> None:
    """It starts the node and keeps adding any transports that are queued for adding"""

    async def _internal_method() -> None:
        try:
            state.cyphal.local_node = make_node(
                NodeInfo(name="com.zubax.sapog.tests.debugger"), reconfigurable_transport=True
            )
            state.cyphal.local_node.start()
            state.cyphal.pseudo_transport = state.cyphal.local_node.presentation.transport
            make_tracers_trackers(state)
            start_listening_for_allocatable_nodes(state)
            print("Tracers should have been set up.")
            while state.gui.gui_running:
                await asyncio.sleep(0.1)
                if not state.queues.attach_transport.empty():
                    try:
                        atr: AttachTransportRequest = state.queues.attach_transport.get_nowait()
                        new_transport = make_transport(atr.get_registry())
                        state.gui.transports_of_windows[atr.requesting_window_id] = new_transport
                        state.cyphal.pseudo_transport.attach_inferior(new_transport)
                        attach_transport_response = AttachTransportResponse(True, atr.requested_interface.iface)
                        state.queues.attach_transport_response.put(attach_transport_response)
                        print("Added a new interface")
                    except Exception as e:
                        tb = traceback.format_exc()
                    else:
                        tb = "Attached transport"
                    finally:
                        attach_transport_response = AttachTransportResponse(False, tb)
                        state.queues.attach_transport_response.put(attach_transport_response)
                if not state.queues.detach_transport.empty():
                    transport = state.queues.detach_transport.get_nowait()
                    state.cyphal.pseudo_transport.detach_inferior(transport)
        except Exception as e:
            logger.exception(e)
            raise e

    asyncio.run(_internal_method())
