// Look  through the list of current_avatars
// and check if any of them have a hash that is not included in the existingHashesList array
// If so then return true
function eqSet(xs, ys) {
    return xs.size === ys.size && [...xs].every((x) => ys.has(x));
}

export function areThereAnyNewOrMissingHashes(hash_property, yukon_state) {
    let current_hashes_set = new Set();
    for (var i = 0; i < yukon_state.current_avatars.length; i++) {
        current_hashes_set.add(yukon_state.current_avatars[i][hash_property]);
    }
    let existing_hashes_object = yukon_state.existingHashesSet[hash_property];
    if (!existing_hashes_object) existing_hashes_object = {set: new Set()};
    const hashes_differ = !eqSet(current_hashes_set, existing_hashes_object.set);
    return hashes_differ;
}

// Clear all existing hashes in last_hashes array
// Add all hashes from yukon_state.current_avatars array to last_hashes array
export function updateLastHashes(hash_property, yukon_state) {
    yukon_state.existingHashesSet[hash_property] = {set: new Set()};
    for (var i = 0; i < yukon_state.current_avatars.length; i++) {
        yukon_state.existingHashesSet[hash_property].set.add(yukon_state.current_avatars[i][hash_property]);
    }
}