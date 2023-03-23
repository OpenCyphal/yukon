import json
import traceback
import typing
import logging

import pycyphal.dsdl
from pycyphal.presentation.subscription_synchronizer import get_local_reception_timestamp
from pycyphal.presentation.subscription_synchronizer.monotonic_clustering import MonotonicClusteringSynchronizer
from yukon.domain.god_state import GodState
from yukon.domain.subscriptions.sync_subscribe_request import SubscribeSynchronizedRequest
from yukon.domain.subscriptions.sync_message_carrier import SynchronizedMessageCarrier
from yukon.domain.subscriptions.sync_message_group import SynchronizedMessageGroup
from yukon.domain.subscriptions.sync_message_store import SynchronizedMessageStore
from yukon.domain.subscriptions.sync_subjects_specifier import SynchronizedSubjectsSpecifier
from yukon.services.dtype_loader import load_dtype
from yukon.services.utils import clamp, tolerance_from_key_delta

logger = logging.getLogger(__name__)


def do_sync_subscribe_work(state: GodState, request: SubscribeSynchronizedRequest) -> None:
    tolerance = 0.1
    try:
        specifiers_object = request.specifiers
        specifiers = json.stringify(specifiers_object)
        synchronized_subjects_specifier = SynchronizedSubjectsSpecifier(specifiers_object)
        if state.cyphal.synchronizers_by_specifier.get(synchronized_subjects_specifier):
            raise Exception("Already subscribed to synchronized messages for this specifier.")
        subscribers = []
        for dto in synchronized_subjects_specifier.specifiers:
            new_subscriber = state.cyphal.local_node.make_subscriber(load_dtype(dto.datatype), dto.subject_id)
            subscribers.append(new_subscriber)
        synchronizer = MonotonicClusteringSynchronizer(subscribers, get_local_reception_timestamp, tolerance)
        state.cyphal.synchronizers_by_specifier[synchronized_subjects_specifier] = synchronizer
        synchronized_message_store = SynchronizedMessageStore(specifiers)
        state.cyphal.synchronized_message_stores[synchronized_subjects_specifier] = synchronized_message_store
        synchronized_message_store.specifiers = specifiers
        counter = 0
        prev_key: typing.Any = None

        def message_receiver(*messages: typing.Tuple[typing.Any, typing.Any]) -> None:
            nonlocal counter, prev_key, synchronized_message_store
            synchronized_message_group = SynchronizedMessageGroup()
            try:
                key = sum(get_local_reception_timestamp(x) for x in messages) / len(messages)
                if prev_key is not None:
                    synchronizer.tolerance = clamp(
                        (1e-6, 10.0),
                        (synchronizer.tolerance + tolerance_from_key_delta(prev_key, key)) * 0.5,
                    )
                prev_key = key
            except:
                tb = traceback.format_exc()
                logger.error(tb)
            for index, message in enumerate(messages):
                metadata = message[1]
                synchronized_message_carrier = SynchronizedMessageCarrier(
                    pycyphal.dsdl.to_builtin(message[0]),
                    {
                        "ts_system": str(metadata.timestamp.system),
                        "ts_monotonic": str(metadata.timestamp.monotonic),
                        "source_node_id": metadata.source_node_id,
                        "priority": metadata.priority,
                        "transfer_id": metadata.transfer_id,
                        "dtype": message[0].__class__.__module__,
                    },
                    counter,
                    synchronized_subjects_specifier.specifiers[index].subject_id,
                )
                counter += 1
                synchronized_message_group.carriers.append(synchronized_message_carrier)
            synchronized_message_store.messages.append(synchronized_message_group)
            synchronized_message_store.counter += 1
            if (
                synchronized_message_store.counter - synchronized_message_store.start_index
            ) >= synchronized_message_store.capacity:
                synchronized_message_store.messages.pop(0)
                synchronized_message_store.start_index += 1

        synchronizer.receive_in_background(message_receiver)
    except Exception as e:
        print("Exception in subscribe_synchronized: " + str(e))
        tb = traceback.format_exc()
        logger.error(tb)
