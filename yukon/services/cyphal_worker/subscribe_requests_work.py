import traceback
import typing
from queue import Queue
from uuid import uuid4
import pycyphal.dsdl

import uavcan
from domain.message_carrier import MessageCarrier
from domain.messages_store import MessagesStore
from yukon.domain.subscribe_response import SubscribeResponse
from yukon.services.messages_publisher import add_local_message
from yukon.services.dtype_loader import load_dtype
from yukon.domain.subscribe_request import SubscribeRequest
from yukon.domain.god_state import GodState


async def do_subscribe_requests_work(state: GodState) -> None:
    if not state.queues.subscribe_requests.empty():
        subscribe_request = state.queues.subscribe_requests.get_nowait()
        try:
            new_subscriber = state.cyphal.local_node.make_subscriber(
                load_dtype(subscribe_request.datatype), subscribe_request.subject_id
            )
            state.cyphal.subscribers_by_subscribe_request[subscribe_request] = new_subscriber

            def callback(msg: typing.Any, metadata: pycyphal.transport.TransferFrom) -> None:
                messages_store = state.queues.subscribe_messages_queues[subscribe_request.get_specifier()]
                message_carrier = MessageCarrier(msg, metadata, messages_store.counter)
                messages_store.counter += 1
                messages_store.messages.append(pycyphal.dsdl.to_builtin(msg))
                add_local_message(state, repr(msg), 20, subscribe_request.subject_id)

            new_subscriber.receive_in_background(callback)
            state.queues.subscribe_messages_queues[subscribe_request.get_specifier()] = MessagesStore()
            subscribe_response = SubscribeResponse(subscribe_request.subject_id, subscribe_request.datatype, True, "")
            state.queues.subscribe_requests_responses.put(subscribe_response)
        except Exception as e:
            tb = traceback.format_exc()
            add_local_message(state, tb, 40)
            subscribe_response = SubscribeResponse(subscribe_request.subject_id, subscribe_request.datatype, False, tb)
            state.queues.subscribe_requests_responses.put(subscribe_response)
        else:
            add_local_message(state, "Subscribed to " + str(subscribe_request.subject_id), 20)
