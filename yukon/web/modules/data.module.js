export async function update_avatars_dto(yukon_state) {
    const obj_result = await yukon_state.zubax_apij.get_avatars()
    // console.log("Avatars DTO updated.")
    yukon_state.current_avatars = obj_result.avatars;
}