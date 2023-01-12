from yukon.domain.transport.detach_transport_request import DetachTransportRequest
from yukon.domain.transport.detach_transport_response import DetachTransportResponse
from yukon.domain.god_state import GodState


async def do_detach_transport_work(state: GodState, detach_request: DetachTransportRequest) -> None:
    interface_hash = detach_request.interface_hash
    transport_about_to_be_detached = state.cyphal.inferior_transports_by_interface_hashes[interface_hash]
    transport_about_to_be_detached.close()
    state.cyphal.pseudo_transport.detach_inferior(transport_about_to_be_detached)

    # find the interface in state.cyphal.transports_list which has the hash matching to interface_hash and remove it
    for interface in state.cyphal.transports_list:
        if str(hash(interface)) == interface_hash:
            if interface.is_udp:
                del state.cyphal.already_used_transport_interfaces[interface.udp_iface]
            else:
                del state.cyphal.already_used_transport_interfaces[interface.iface]
            state.avatar.avatars_by_node_id = {}
            state.queues.detach_transport_response.put(DetachTransportResponse(True, interface, "Detached transport"))
            state.cyphal.transports_list.remove(interface)
            break
