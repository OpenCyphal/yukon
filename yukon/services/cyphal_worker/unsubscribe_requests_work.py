import traceback
import logging

from yukon.domain.subscriptions.unsubscribe_request import UnsubscribeRequest
from yukon.domain.subscriptions.unsubscribe_response import UnsubscribeResponse
from yukon.domain.subscriptions.subscribe_response import SubscribeResponse
from yukon.services.messages_publisher import add_local_message
from yukon.domain.god_state import GodState

logger = logging.getLogger(__name__)


async def do_unsubscribe_requests_work(state: GodState, unsubscribe_request: UnsubscribeRequest) -> None:
    try:
        if unsubscribe_request.specifier.subject_id == "":
            raise Exception("Subject ID is empty")
        for subscribe_request in state.cyphal.subscribers_by_subscribe_request:
            if subscribe_request.specifier == unsubscribe_request.specifier:
                state.cyphal.subscribers_by_subscribe_request[subscribe_request].close()
                del state.cyphal.subscribers_by_subscribe_request[subscribe_request]
                del state.cyphal.message_stores_by_specifier[subscribe_request.specifier]
                unsubscribe_response = SubscribeResponse(
                    unsubscribe_request.specifier.subject_id, unsubscribe_request.specifier.datatype, True, ""
                )
                state.queues.unsubscribe_requests_responses.put(unsubscribe_response)
                break
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(tb)
        subscribe_response = UnsubscribeResponse(
            unsubscribe_request.specifier.subject_id, unsubscribe_request.specifier.datatype, False, tb
        )
        state.queues.unsubscribe_requests_responses.put(subscribe_response)
    else:
        logger.info("Unsubscribed from %s", str(unsubscribe_request.specifier))
