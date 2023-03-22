from yukon.domain.commands.store_persistent_states_request import StorePersistentStatesRequest


async def do_send_store_persistent_states_work(state: GodState, request: StorePersistentStatesRequest) -> None:
    target_node_id = request.node_id
    await asyncio.sleep(request.delay_seconds)
    stop_retry = False
    retry_count = 0
    while not stop_retry:
        if retry_count > 5:
            logger.error(
                "Failed to send persistent states to node %s, tried %d times", str(target_node_id), retry_count
            )
            return
        restart_command = uavcan.node.ExecuteCommand_1_0.Request()
        restart_command.command = uavcan.node.ExecuteCommand_1_0.Request.COMMAND_STORE_PERSISTENT_STATES
        command_client = state.cyphal.local_node.make_client(uavcan.node.ExecuteCommand_1_0, target_node_id)
        response_tuple = await command_client.call(restart_command)
        
        message = None
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
        if not was_command_success:
            logger.error("Failed to send store persistent states to node %s", str(target_node_id))
            if message:
                logger.error(message)
            retry_count += 1
        else:
            logger.info("Successfully sent store persistent states to node %s", str(target_node_id))
            return
