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
    407: "Modify ( a file)",
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

export function getConfiguredSubjectServiceName(intId, yukon_state) {
    let possibleRegisterNames = [];
    for (var i = 0; i < yukon_state.current_avatars.length; i++) {
        const avatar = yukon_state.current_avatars[i];
        const explodedRegistersKeys = Object.keys(avatar.registers_values);
        for (var j = 0; j < explodedRegistersKeys.length; j++) {
            const register_name = explodedRegistersKeys[j];
            const value = avatar.registers_values[register_name];
            if (parseInt(value) == intId && register_name.includes(".id")) {
                possibleRegisterNames.push(register_name);
            }
        }
    }
    return Array.from(new Set(possibleRegisterNames));
}