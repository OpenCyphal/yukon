import json
import time
import traceback
from datetime import datetime
from typing import Optional

import uavcan
from yukon.domain.update_register_request import UpdateRegisterRequest
from yukon.domain.update_register_log_item import UpdateRegisterLogItem
from yukon.domain.update_register_response import UpdateRegisterResponse
from yukon.services.enhanced_json_encoder import EnhancedJSONEncoder
from yukon.services.messages_publisher import add_local_message
from yukon.services.value_utils import explode_value
from yukon.domain.no_success import NoSuccess
from yukon.domain.god_state import GodState


class NoResponse(Exception):
    def __init__(self, node_id: int):
        super().__init__(f"No response received from the node {node_id}.")


class RegisterDoesNotExistOnNode(Exception):
    def __init__(self, register_name: str, node_id: int):
        super().__init__(f"Register {register_name} does not exist on node {node_id}")


class NodeDoesNotExist(Exception):
    def __init__(self, node_id: int):
        super().__init__(f"Node {node_id} does not exist")


def assemble_response_and_log_item(
    state: GodState,
    register_update: UpdateRegisterRequest,
    value_before_update: Optional[str],
    message: Optional[str],
    success: bool,
) -> None:
    response_from_yukon = UpdateRegisterResponse(
        register_update.request_id,
        register_update.register_name,
        register_update.value,
        register_update.node_id,
        success,
        message,
    )
    response_received_time = datetime.fromtimestamp(time.time()).strftime("%H:%M:%S.%f")
    log_item: UpdateRegisterLogItem = UpdateRegisterLogItem(
        response_from_yukon,
        register_update.register_name,
        datetime.fromtimestamp(register_update.request_sent_time).strftime("%H:%M:%S.%f"),
        response_received_time,
        value_before_update,
        success,
    )
    state.cyphal.register_update_log.append(log_item)
    state.queues.update_registers_response[response_from_yukon.request_id] = response_from_yukon
    message_severity = 20 if success else 40
    if message:
        add_local_message(state, message, message_severity, register_update.register_name)


async def do_update_register_work(state: GodState, register_update: UpdateRegisterRequest) -> None:
    try:
        try:
            value_before_update: str = state.avatar.avatars_by_node_id[register_update.node_id].register_values[
                register_update.register_name
            ]
        except KeyError as e:
            raise NodeDoesNotExist(register_update.node_id)
        response_received_time = None
        client = state.cyphal.local_node.make_client(uavcan.register.Access_1, register_update.node_id)
        request = uavcan.register.Access_1.Request()
        request.name.name = register_update.register_name
        request.value = register_update.value
        # We don't need the response here because it is snooped by an avatar anyway
        response = await client.call(request)
        if response is None:
            raise NoResponse(register_update.node_id)
        access_response, transfer_object = response
        if not access_response.mutable:
            raise NoSuccess("Failed to update register {}, it is not mutable".format(register_update.register_name))
        if isinstance(access_response.value.empty, uavcan.primitive.Empty_1):
            raise RegisterDoesNotExistOnNode(register_update.register_name, register_update.node_id)
        assemble_response_and_log_item(state, register_update, value_before_update, None, True)
    except NoSuccess as e:
        tb = traceback.format_exc()
        assemble_response_and_log_item(state, register_update, value_before_update, tb, False)
    except RegisterDoesNotExistOnNode as e:
        tb = traceback.format_exc()
        assemble_response_and_log_item(state, register_update, value_before_update, tb, False)
    except NodeDoesNotExist as e:
        tb = traceback.format_exc()
        assemble_response_and_log_item(state, register_update, None, tb, False)
