export const meanings = {
    430: "GetInfo (about node)",
    434: "GetTransportStatistics",
    435: "ExecuteCommand",
    7509: "Heartbeat",
    7510: "List (ports)",
    384: "Access (register)",
    385: "List (registers)",
    8184: "Record (diagnostic)",
    405: "GetInfo (about a file)",
    406: "List (files)",
    407: "Modify (a file)",
    408: "Read (a file)",
    409: "Write (a file)",
    8165: "NodeIDAllocationData.2.0",
    8166: "NodeIDAllocationData.1.0",
    390: "AppendEntries (to a pnp cluster)",
    391: "RequestVote ( in a pnp cluster)",
    8164: "Discovery (in a pnp cluster)",
    510: "GetSynchronizationMasterInfo (time)",
    7168: "Synchronization (time)",
    500: "HandleIncomingPacket (udp)",
    8174: "OutgoingPacket (udp)",
}

export function getLinkInfo(subject_id, node_id, yukon_state) {
    let infos = [];
    for (const avatar of yukon_state.current_avatars) {
        if (avatar.node_id === node_id || !node_id) {
            const registersKeys = Object.keys(avatar.registers_values);
            for (let j = 0; j < registersKeys.length; j++) {
                const register_name = registersKeys[j];
                const register_name_split = register_name.split(".");
                const link_name = register_name_split[register_name_split.length - 2];
                const value = avatar.registers_values[register_name];
                if (parseInt(value) === subject_id && register_name.endsWith(".id")) {
                    const datatype = registersKeys.find((a) => a.endsWith(link_name + ".type"));
                    infos.push({ name: link_name, type: avatar.registers_values[datatype] });
                }
            }
        }
    }
    return Array.from(new Set(infos));
}
export function getRelatedLinks(port, yukon_state) {
    let links = [];
    for (const avatar of yukon_state.current_avatars) {
        const registersKeys = Object.keys(avatar.registers_values);
        for (let j = 0; j < registersKeys.length; j++) {
            const register_name = registersKeys[j];
            const register_name_split = register_name.split(".");
            const link_name = register_name_split[register_name_split.length - 2];
            const value = avatar.registers_values[register_name];
            if (parseInt(value) === port && register_name.endsWith(".id")) {
                const datatype_key = registersKeys.find((a) => a.endsWith(link_name + ".type"));
                const datatype = avatar.registers_values[datatype_key];
                links.push({ name: link_name, node_id: avatar.node_id, "port": port, type: register_name_split[1], "full_name": register_name, "datatype": datatype });
            }
        }
    }
    return Array.from(new Set(links));
}