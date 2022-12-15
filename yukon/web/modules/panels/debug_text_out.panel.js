function setUpDebugTextOutComponent(yukon_state) {
    let isRefreshTextOutAllowed = true;

    async function updateTextOut(refresh_anyway = false) {
        if (!isRefreshTextOutAllowed && !refresh_anyway) {
            return;
        }
        const avatars = await zubax_api.get_avatars();
        const textOut = document.querySelector("#textOut");
        const DTO = JSON.parse(avatars, JsonParseHelper);
        if (DTO.hash != yukon_state.lastHash || refresh_anyway) {
            yukon_state.lastHash = DTO.hash;
            textOut.innerHTML = JSON.stringify(DTO.avatars, null, 4)
        }
        // Parse avatars as json
    }

    // setInterval(updateTextOut, 1000);
    const cbStopTextOutRefresh = document.querySelector("#cbStopTextOutRefresh");
    cbStopTextOutRefresh.addEventListener("change", () => {
        if (cbStopTextOutRefresh.checked) {
            isRefreshTextOutAllowed = false;
        } else {
            isRefreshTextOutAllowed = true;
        }
    });
    const btnRefreshTextOut = document.querySelector("#btnRefreshTextOut");
    btnRefreshTextOut.addEventListener("click", async () => {
        await updateTextOut(true);
    });
}