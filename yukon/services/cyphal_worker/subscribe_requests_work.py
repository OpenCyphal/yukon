import uavcan
from yukon.domain.god_state import GodState


async def do_subscribe_requests_work(state: GodState) -> None:
    if not state.queues.subscribe_requests.empty():
        try:
            subscribe_request = state.queues.subscribe_requests.get_nowait()
            state.cyphal.local_node.make_subscriber(uavcan.si.unit.temperature.Scalar_1, "temperature_setpoint")
            state.queues.subscribe_requests_responses.put("Subscribed to " + str(subscribe_request.subject))
        except Exception as e:
            state.queues.subscribe_responses.put(str(e))
