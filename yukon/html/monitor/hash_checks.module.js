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
    return !eqSet(current_hashes_set, yukon_state.existingHashesSet.set);
}
// Clear all existing hashes in last_hashes array
// Add all hashes from yukon_state.current_avatars array to last_hashes array
export function updateLastHashes(hash_property, yukon_state) {
    yukon_state.existingHashesSet.set = new Set();
    for (var i = 0; i < yukon_state.current_avatars.length; i++) {
        yukon_state.existingHashesSet.set.add(yukon_state.current_avatars[i][hash_property]);
    }
}