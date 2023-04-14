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
export function getRelatedLinks(port, port_type, yukon_state) {
    let links = [];
    for (const avatar of yukon_state.current_avatars) {
        const registersKeys = Object.keys(avatar.registers_values);
        for (let j = 0; j < registersKeys.length; j++) {
            const register_name = registersKeys[j];
            const regex = /uavcan\.(pub|sub|cln|srv)\.(.+?)\.id/;
            // Use regex to extract the first and second ground, first group is link_type and second group is link_name from register_name
            const results = register_name.match(regex);
            if(!results) continue;
            const link_type = results[1];
            const link_name = results[2];
            const value = avatar.registers_values[register_name];
            if (parseInt(value) === parseInt(port) && register_name.endsWith(".id")) {
                if((port_type === "pub" || port_type === "sub") && (link_type === "cln" || link_type === "srv")) continue;
                const datatype_key = registersKeys.find((a) => a.endsWith(link_name + ".type"));
                const datatype = avatar.registers_values[datatype_key];
                links.push({ name: link_name, node_id: avatar.node_id, "port": port, type: link_type, "register_name": register_name, "datatype": datatype });
            }
        }
    }
    return Array.from(new Set(links));
}

function decodeFaultCode(faultCode) {
    if(faultCode >= 0 && faultCode <= 9) {
        return `runtime error with code ${faultCode}`;
    } else if (faultCode === 10) {
        return "runtime error with error code greater than 9";
    } else if (faultCode === 14) {
        return "hardware error";
    } else if (faultCode === 15) {
        return "invalid parameters error";
    }
}

// TODO: Don't forget to change the call of this
export function decodeTelegaVSSC(health, mode, vssc) {
    const high_number = Math.floor(vssc / 16);
    const low_number = vssc % 16;
    const fault_high_numbers = [0, 1, 2, 5, 7]
    if(health === "WARNING") {
        if(mode === "Initialization") {
            return "Uninitialized state, normal operation impossible";
        }
    } else if (health === "CAUTION" || (health === "NOMINAL" && mode === "MAINTENANCE")) {
        if(mode === "OPERATIONAL") {
            switch(high_number) {
                case 0:
                    return "standby " + decodeFaultCode(low_number);
                case 1:
                    return "self test " + decodeFaultCode(low_number);
                case 2:
                    return "motor ID " + decodeFaultCode(low_number);
                case 5:
                    return "drive " + decodeFaultCode(low_number);
                case 7:
                    return "servo " + decodeFaultCode(low_number);
            }
        }
    } else if (health === "NOMINAL") {
        switch (high_number) {
            case 0:
                return "standby";
            case 1:
                return "self test";
            case 2:
                return "motor ID";
            case 5:
                switch (low_number) {
                    case 1:
                        return "drive torque control mode";
                    case 2:
                        return "drive voltage control mode";
                    case 3:
                        return "drive velocity control mode";
                    case 9:
                        return "drive ratiometric torque control mode";
                    case 10:
                        return "drive ratiometric voltage control mode";
                }
                return "drive";
            case 7:
                return "servo"
        }
    }
    return "Unknown code";
}