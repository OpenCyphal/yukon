import uavcan
import logging

from yukon.domain.command_send_response import CommandSendResponse
from yukon.domain.god_state import GodState

logger = logging.getLogger(__name__)


async def do_send_command_work(state: GodState) -> None:
    if not state.queues.send_command.empty():
        was_command_success = False
        stop_retry = False
        max_count = 3
        count = 0
        message = None
        while not was_command_success and count < max_count and not stop_retry:
            count += 1
            try:
                send_command_request = state.queues.send_command.get_nowait()
                if send_command_request.node_id < 0:
                    message = "Node ID must be positive!"
                    stop_retry = True
                    raise Exception("Node ID must be positive")
                if len(state.cyphal.already_used_transport_interfaces.keys()) == 0:
                    message = "No transports attached!"
                    stop_retry = True
                    raise Exception("No transports attached")
                if not state.avatar.avatars_by_node_id.get(send_command_request.node_id):
                    message = "There is no such node with ID " + str(send_command_request.node_id)
                    stop_retry = True
                    raise Exception("There is no such node with ID " + str(send_command_request.node_id))
                service_client = state.cyphal.local_node.make_client(
                    uavcan.node.ExecuteCommand_1_1, send_command_request.node_id
                )
                msg = uavcan.node.ExecuteCommand_1_1.Request()
                msg.command = int(send_command_request.command_id)
                msg.parameter = send_command_request.text_argument
                response_tuple = await service_client.call(msg)
                if response_tuple:
                    stop_retry = True
                    response = response_tuple[0]
                    if response.status == 1:
                        message = "Device responds: failure"
                    elif response.status == 2:
                        message = "Device responds: not authorized"
                    elif response.status == 3:
                        message = "Device responds: bad command"
                    elif response.status == 4:
                        message = "Device responds: bad parameter"
                    elif response.status == 5:
                        message = "Device responds: bad state"
                    elif response.status == 6:
                        message = "Device responds: internal error"
                    else:
                        message = repr(response)
                        if response.status == 0:
                            message = "✓ " + message
                            message += " (success)"
                was_command_success = response is not None and response.status == 0
            except Exception as e:
                logger.exception("Failure sending command %s on try %d", send_command_request, count)

        if not was_command_success:
            if not message:
                message = "Failed"
            state.queues.command_response.put(CommandSendResponse(False, message))
        else:
            if not message:
                message = "Success"
            state.queues.command_response.put(CommandSendResponse(True, message))
