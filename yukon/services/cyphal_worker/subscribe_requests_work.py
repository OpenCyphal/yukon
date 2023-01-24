import json
import logging
import sys
import traceback
import typing
import pycyphal.dsdl

from yukon.domain.subscriptions.subscribe_request import SubscribeRequest
from yukon.services.enhanced_json_encoder import EnhancedJSONEncoder
from yukon.domain.subscriptions.message_carrier import MessageCarrier
from yukon.domain.subscriptions.messages_store import MessagesStore
from yukon.domain.subscriptions.subscribe_response import SubscribeResponse
from yukon.services.dtype_loader import load_dtype
from yukon.domain.god_state import GodState

logger = logging.getLogger(__name__)


async def do_subscribe_requests_work(state: GodState, subscribe_request: SubscribeRequest) -> None:
    logger.debug("Current PYTHONPATH: %s", sys.path)
    try:
        if not subscribe_request.specifier.subject_id:
            new_subscriber = state.cyphal.local_node.make_subscriber(load_dtype(subscribe_request.specifier.datatype))
        else:
            new_subscriber = state.cyphal.local_node.make_subscriber(
                load_dtype(subscribe_request.specifier.datatype), subscribe_request.specifier.subject_id
            )

        state.cyphal.subscribers_by_subscribe_request[subscribe_request] = new_subscriber

        def callback(msg: typing.Any, metadata: pycyphal.transport.TransferFrom) -> None:
            messages_store = state.cyphal.message_stores_by_specifier.get(subscribe_request.specifier)
            if messages_store:
                message_carrier = MessageCarrier(
                    pycyphal.dsdl.to_builtin(msg),
                    {"source_node_id": metadata.source_node_id, "timestamp": str(metadata.timestamp.monotonic)},
                    messages_store.counter,
                    subscribe_request.specifier.subject_id,
                )
                if messages_store.enable_udp_output and state.udp_server.is_running:
                    json_message = json.dumps(pycyphal.dsdl.to_builtin(msg), cls=EnhancedJSONEncoder)
                    state.udp_server.send(json_message)
                messages_store.counter += 1
                messages_store.messages.append(message_carrier)
                # If the counter exceeds the capacity, remove the oldest message
                if messages_store.counter > messages_store.capacity:
                    # TODO: Potential performance bottleneck
                    messages_store.messages.pop(0)
                    messages_store.counter -= 1
                    messages_store.start_index += 1

        new_subscriber.receive_in_background(callback)
        state.cyphal.message_stores_by_specifier[subscribe_request.specifier] = MessagesStore()
        subscribe_response = SubscribeResponse(
            subscribe_request.specifier.subject_id, subscribe_request.specifier.datatype, True, ""
        )
        state.queues.subscribe_requests_responses.put(subscribe_response)
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(str(e))
        logger.error(str(tb))
        subscribe_response = SubscribeResponse(
            subscribe_request.specifier.subject_id, subscribe_request.specifier.datatype, False, str(tb)
        )
        state.queues.subscribe_requests_responses.put(subscribe_response)
    else:
        logger.info("Subscribed to " + str(subscribe_request.specifier.subject_id))
