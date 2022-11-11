import traceback

from yukon.domain.unsubscribe_request import UnsubscribeRequest
from yukon.domain.unsubscribe_response import UnsubscribeResponse
from yukon.domain.subscribe_response import SubscribeResponse
from yukon.services.messages_publisher import add_local_message
from yukon.domain.god_state import GodState


async def do_unsubscribe_requests_work(state: GodState, unsubscribe_request: UnsubscribeRequest) -> None:
    if not state.queues.unsubscribe_requests.empty():
        unsubscribe_request = state.queues.unsubscribe_requests.get_nowait()
        try:
            if unsubscribe_request.specifier.subject_id == "":
                raise Exception("Subject ID is empty")
            for subscribe_request in state.cyphal.subscribers_by_subscribe_request:
                if subscribe_request.specifier == unsubscribe_request.specifier:
                    state.cyphal.subscribers_by_subscribe_request[subscribe_request].close()
                    del state.cyphal.subscribers_by_subscribe_request[subscribe_request]
                    del state.queues.subscribed_messages[subscribe_request.specifier]
                    unsubscribe_response = SubscribeResponse(
                        unsubscribe_request.specifier.subject_id, unsubscribe_request.specifier.datatype, True, ""
                    )
                    state.queues.unsubscribe_requests_responses.put(unsubscribe_response)
                    break
        except Exception as e:
            tb = traceback.format_exc()
            add_local_message(state, tb, 40)
            subscribe_response = UnsubscribeResponse(
                unsubscribe_request.specifier.subject_id, unsubscribe_request.specifier.datatype, False, tb
            )
            state.queues.unsubscribe_requests_responses.put(subscribe_response)
        else:
            add_local_message(state, "Unsubscribed from " + str(unsubscribe_request.specifier), 20)
