import json
import time
import traceback
from datetime import datetime

import uavcan
from yukon.domain.update_register_log_item import UpdateRegisterLogItem
from yukon.domain.update_register_response import UpdateRegisterResponse
from yukon.services.enhanced_json_encoder import EnhancedJSONEncoder
from yukon.services.messages_publisher import add_local_message
from yukon.services.value_utils import explode_value
from yukon.domain.no_success import NoSuccess
from yukon.domain.god_state import GodState


class RegisterDoesNotExistOnNode(Exception):
    def __init__(self, register_name: str, node_id: int):
        super().__init__(f"Register {register_name} does not exist on node {node_id}")


class NodeDoesNotExist(Exception):
    def __init__(self, node_id: int):
        super().__init__(f"Node {node_id} does not exist")


async def do_update_register_work(state: GodState) -> None:
    if not state.queues.update_registers.empty():
        register_update = state.queues.update_registers.get_nowait()
        # make a uavcan.register.Access_1 request to the node
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
                raise NoSuccess(
                    "Failed to update register {}, no response was received from {}".format(
                        register_update.register_name, register_update.node_id
                    )
                )
            response_received_time = datetime.fromtimestamp(time.time()).strftime("%H:%M:%S.%f")
            access_response, transfer_object = response
            if not access_response.mutable:
                raise NoSuccess("Failed to update register {}, it is not mutable".format(register_update.register_name))
            if isinstance(access_response.value.empty, uavcan.primitive.Empty_1):
                raise RegisterDoesNotExistOnNode(register_update.register_name, register_update.node_id)
            verification_exploded_value = explode_value(
                access_response.value,
                simplify=True,
                metadata={"mutable": access_response.mutable, "persistent": access_response.persistent},
            )
            verification_exploded_value_str = json.dumps(verification_exploded_value, cls=EnhancedJSONEncoder)
            response_from_yukon = UpdateRegisterResponse(
                register_update.request_id,
                register_update.register_name,
                verification_exploded_value_str,
                register_update.node_id,
                True,
                f"A successful register update, value for {register_update.register_name} was sent to node {register_update.node_id}: "
                f"{register_update.value}",
            )
            success_log_item: UpdateRegisterLogItem = UpdateRegisterLogItem(
                response_from_yukon,
                register_update.register_name,
                datetime.fromtimestamp(register_update.request_sent_time).strftime("%H:%M:%S.%f"),
                response_received_time,
                value_before_update,
                True,
            )
            state.cyphal.register_update_log.append(success_log_item)
            state.queues.update_registers_response[response_from_yukon.request_id] = response_from_yukon
        except NoSuccess as e:
            tb = traceback.format_exc()
            response_from_yukon = UpdateRegisterResponse(
                register_update.request_id,
                register_update.register_name,
                register_update.value,
                register_update.node_id,
                False,
                tb,
            )
            log_item: UpdateRegisterLogItem = UpdateRegisterLogItem(
                response_from_yukon,
                register_update.register_name,
                datetime.fromtimestamp(register_update.request_sent_time).strftime("%H:%M:%S.%f"),
                response_received_time,
                value_before_update,
                False,
            )
            state.cyphal.register_update_log.append(log_item)
            state.queues.update_registers_response[response_from_yukon.request_id] = response_from_yukon
            add_local_message(state, tb, register_update.register_name)
        except RegisterDoesNotExistOnNode as e:
            tb = traceback.format_exc()
            response_from_yukon = UpdateRegisterResponse(
                register_update.request_id,
                register_update.register_name,
                register_update.value,
                register_update.node_id,
                False,
                tb,
            )
            log_item2: UpdateRegisterLogItem = UpdateRegisterLogItem(
                response_from_yukon,
                register_update.register_name,
                datetime.fromtimestamp(register_update.request_sent_time).strftime("%H:%M:%S.%f"),
                response_received_time,
                value_before_update,
                False,
            )
            state.cyphal.register_update_log.append(log_item2)
            state.queues.update_registers_response[response_from_yukon.request_id] = response_from_yukon
            add_local_message(state, tb, register_update.register_name)
        except NodeDoesNotExist as e:
            tb = traceback.format_exc()
            response_from_yukon = UpdateRegisterResponse(
                register_update.request_id,
                register_update.register_name,
                register_update.value,
                register_update.node_id,
                False,
                str(e),
            )
            log_item3: UpdateRegisterLogItem = UpdateRegisterLogItem(
                response_from_yukon,
                register_update.register_name,
                datetime.fromtimestamp(register_update.request_sent_time).strftime("%H:%M:%S.%f"),
                None,
                value_before_update,
                False,
            )
            state.cyphal.register_update_log.append(log_item3)
            state.queues.update_registers_response[response_from_yukon.request_id] = response_from_yukon
            add_local_message(state, str(e), register_update.register_name)
