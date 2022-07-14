import asyncio
from datetime import datetime
import json
import logging
import re
import typing
from itertools import chain
from threading import Thread
from trace import Trace

import pycyphal
from pycyphal.application.node_tracker import NodeTracker, Entry
from pycyphal.transport import Tracer, _tracer, TransferTrace
from pycyphal.transport.can import CANErrorTrace, CANTransport
from pycyphal.transport.redundant import RedundantTransport
from pycyphal.util import iter_descendants

from domain.KucherXState import KucherXState

from pycyphal.application import make_node
from pycyphal.application import NodeInfo

logger = logging.getLogger("can_debugger")
logger.setLevel("NOTSET")


def format_payload_hex_view(fragmented_payload: typing.Sequence[memoryview]) -> str:
    payload: str = ""
    count = 0
    for memory_view in fragmented_payload:
        my_list = memory_view.tolist()
        for byte in bytes(my_list):
            payload += '{:02X} '.format(byte)
        else:
            payload = payload[:len(payload) - 1]
        count += 1
        if count >= 4:
            payload += "\n"
            count = 0
        else:
            payload += " | "
    else:
        payload = payload[:len(payload) - len(" |")]
    return payload


def format_payload_hex_view_trace(trace: Trace):
    return format_payload_hex_view(trace.transfer.fragmented_payload)


def deserialize_trace(trace: Trace, ids: typing.Dict[int, typing.Any], subject_id: int, debugger_id: int):
    transfer_type = "service" if "service" in str(trace.transfer).lower() else "message"
    if ids.get(subject_id) is None:
        return f"{transfer_type} CONFIGURED {subject_id}, from {trace.transfer.metadata.session_specifier.source_node_id} " \
               f"to {trace.transfer.metadata.session_specifier.destination_node_id}" \
               f"\n{str(trace.transfer)}"
    try:
        obj = pycyphal.dsdl.deserialize(ids[subject_id], trace.transfer.fragmented_payload)
        built_in_representation = pycyphal.dsdl.to_builtin(obj)
    except TypeError:
        built_in_representation = {}
    if "clients" in built_in_representation.keys():
        built_in_representation["clients"] = None
    if "servers" in built_in_representation.keys():
        built_in_representation["servers"] = None

    transfer_deserialized = str(trace.transfer)
    if trace.transfer.metadata.session_specifier.source_node_id == debugger_id:
        transfer_deserialized = transfer_deserialized.replace(f"source_node_id={debugger_id}",
                                                              f"source_node_id={debugger_id} (this)")
    if trace.transfer.metadata.session_specifier.destination_node_id == debugger_id:
        transfer_deserialized = transfer_deserialized.replace(f"destination_node_id={debugger_id}",
                                                              f"destination_node_id={debugger_id} (this)")
    transfer_deserialized = transfer_deserialized.replace(
        "AlienTransfer(AlienTransferMetadata(AlienSessionSpecifier(",
        "transfer(")
    for key, value in ids.items():
        transfer_deserialized = transfer_deserialized.replace("subject_id=" + str(key),
                                                              "subject_id=" + value.__name__ + f"({str(key)})")
        transfer_deserialized = transfer_deserialized.replace("service_id=" + str(key),
                                                              "service_id=" + value.__name__ + f"({str(key)})")
    transfer_deserialized = re.sub(r"fragmented_payload=\[[^\[\]]+?\]", json.dumps(built_in_representation),
                                   transfer_deserialized)
    transfer_deserialized = transfer_deserialized.replace("transfer(ServiceDataSpecifier(", "")
    transfer_deserialized = transfer_deserialized.replace("source_node_id", "src_id")
    transfer_deserialized = transfer_deserialized.replace("destination_node_id", "dest_id")
    transfer_deserialized = transfer_deserialized.replace("priority", "prio")
    transfer_deserialized = transfer_deserialized.replace(", role=<Role.REQUEST: 1>)", "")
    transfer_deserialized = transfer_deserialized.replace("role=<Role.RESPONSE: 2>)", "")
    transfer_deserialized = transfer_deserialized.replace("transfer_id", "t_id")
    transfer_deserialized = transfer_deserialized.replace("), {})", "")
    transfer_deserialized = transfer_deserialized.replace("service_id=", "")
    transfer_deserialized = transfer_type + " " + transfer_deserialized + "\n" + format_payload_hex_view_trace(trace)
    return transfer_deserialized


def make_capture_handler(tracer: Tracer, ids: typing.Dict[int, typing.Any], debugger_id_for_filtering: int,
                         log_to_logger=None,
                         log_to_file=True, log_to_print=True, ignore_traffic_by_debugger=True):
    logger.info("Capture handler was registered.")

    def capture_handler(capture: _tracer.Capture):
        logger.info("Something was received.")
        with open("rx_frm.txt", "a") as log_file:
            # Checking to see if a transfer has finished, then assigning the value to transfer_trace
            if (transfer_trace := tracer.update(capture)) is not None:
                if isinstance(transfer_trace, CANErrorTrace):
                    print(transfer_trace)
                elif isinstance(transfer_trace, TransferTrace):
                    is_service_request: bool = hasattr(
                        transfer_trace.transfer.metadata.session_specifier.data_specifier,
                        "service_id")
                    is_sending_node_debugger = transfer_trace.transfer.metadata.session_specifier.source_node_id == debugger_id_for_filtering
                    if ignore_traffic_by_debugger and is_sending_node_debugger and not is_service_request:
                        return
                    if is_service_request:
                        subject_id = transfer_trace.transfer.metadata.session_specifier.data_specifier.service_id
                    else:
                        subject_id = transfer_trace.transfer.metadata.session_specifier.data_specifier.subject_id
                    deserialized_trace = deserialize_trace(transfer_trace, ids, subject_id, debugger_id_for_filtering)
                    if deserialized_trace is None:
                        return
                    message = f"{datetime.now().strftime('%H:%M:%S:%f')} {deserialized_trace}"
                    if log_to_logger:
                        log_to_logger.info(message)
                    elif log_to_print:
                        print(message)
                    if log_to_file:
                        log_file.write(deserialized_trace + "\n")

    return capture_handler


def make_handler_for_getinfo_update():
    def handle_getinfo_handler_format(node_id: int, previous_entry: typing.Optional[Entry],
                                      next_entry: typing.Optional[Entry]):
        async def handle_inner_function():
            if node_id and next_entry and next_entry.info is not None:
                # print("Debugger sees an allocation request")
                await asyncio.sleep(2)

        asyncio.get_event_loop().create_task(handle_inner_function())

    return handle_getinfo_handler_format


def make_node_debugger(state: KucherXState):
    logger.info("Debugger is being set up")
    state.tracer = state.local_node.presentation.transport.make_tracer()
    current_transport = state.local_node.presentation.transport
    current_transport.begin_capture(
        make_capture_handler(state.tracer, {}, log_to_file=False, log_to_print=True,
                             debugger_id_for_filtering=state.local_node.id, log_to_logger=logger))
    state.tracker = NodeTracker(state.local_node)
    state.tracker.add_update_handler(make_handler_for_getinfo_update())
