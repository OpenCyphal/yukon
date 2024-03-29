import json
import time
import logging
import traceback
from uuid import uuid4

from yukon.domain.registers.apply_configuration_request import ApplyConfigurationRequest
from yukon.domain.registers.update_register_request import UpdateRegisterRequest
from yukon.services.api import is_configuration_simplified, add_register_update_log_item
from yukon.services.value_utils import unexplode_value
from yukon.domain.god_state import GodState

logger = logging.getLogger(__name__)


async def do_apply_configuration_work(state: GodState, config: ApplyConfigurationRequest) -> None:
    if config.node_id and not config.is_network_config:
        data = json.loads(config.configuration)
        if is_configuration_simplified(data):
            at_least_one_register_was_modified = False
            for register_name, register_value in data.items():
                prototype_string = state.avatar.avatars_by_node_id[int(config.node_id)].registers_exploded_values.get(
                    register_name, None
                )
                if prototype_string is None:
                    logger.log(logging.ERROR, "Register %s does not exist on node %d" % (register_name, config.node_id))
                    add_register_update_log_item(state, register_name, None, config.node_id, False)
                    continue
                at_least_one_register_was_modified = True
                prototype = unexplode_value(prototype_string)
                unexploded_value = unexplode_value(register_value, prototype)
                state.queues.god_queue.put_nowait(
                    UpdateRegisterRequest(uuid4(), register_name, unexploded_value, config.node_id, time.time())
                )
            if not at_least_one_register_was_modified:
                logger.warning("No registers were modified on node %d", config.node_id)
        else:
            for potential_node_id, v in data.items():
                if potential_node_id == "__file_name":
                    continue
                for register_name, value in v.items():
                    if isinstance(value, str):
                        logger.debug("Do something")
                        value = json.loads(value)
                    unexploded_value = unexplode_value(value)
                    state.queues.god_queue.put_nowait(
                        UpdateRegisterRequest(uuid4(), register_name, unexploded_value, config.node_id, time.time())
                    )
    elif config.is_network_config:
        logger.debug("Setting configuration for all configured nodes")
        data = json.loads(config.configuration)
        for node_id, registers_values_exploded in data.items():
            if "__" in node_id:
                continue
            # If register_values_exploded is not a dict, it is an error
            if not isinstance(registers_values_exploded, dict):
                logger.error(f"Configuration for node {node_id} is not a dict")
                continue
            for k, v in registers_values_exploded.items():
                state.queues.god_queue.put_nowait(
                    UpdateRegisterRequest(uuid4(), k, unexplode_value(v), int(node_id), time.time())
                )
    else:
        tb = traceback.format_exc()
        logger.critical(tb)
