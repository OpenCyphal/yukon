import logging
import yukon
from yukon.domain.fileserver.run_fileserver_request import RunFileserverRequest
from yukon.services.FileServer import FileServer

logger = logging.getLogger(__name__)


async def do_run_fileserver_work(state: "yukon.domain.god_state.GodState", request: RunFileserverRequest) -> None:
    def _run_file_server() -> None:
        logger.info("File server created and started.")
        state.cyphal.file_server = FileServer(
            state.cyphal.local_node, [state.settings["Firmware updates"]["Directory path"]["value"].value]
        )
        logger.info(
            "File server started on path " + state.settings["Firmware updates"]["Directory path"]["value"].value
        )
        state.cyphal.file_server.start()

    if not state.cyphal_worker_asyncio_loop:
        logger.debug("No asyncio loop, postponing allocator run")
        state.callbacks["yukon_node_attached"].append(_run_file_server)
    else:
        assert state.cyphal.local_node
        assert state.cyphal.local_node.id
        state.cyphal_worker_asyncio_loop.call_soon_threadsafe(_run_file_server)
