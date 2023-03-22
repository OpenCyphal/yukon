from yukon.domain.run_allocator_request import RunAllocatorRequest

async def do_run_allocator_work(state: GodState, request: RunAllocatorRequest) -> None:
    new_mode = request.mode
    if (new_mode in ["Automatic", "Automatic persistent allocation"]) and not state.cyphal.centralized_allocator:
            logger.info("Some kind of automatic allocator is now enabled")
            # For the current thread, the same event loop is used
            def _run_allocator() -> None:
                def _run_allocator_inner() -> None:
                    try:
                        if state.cyphal.local_node:
                            logger.debug("Now running allocator")
                            state.cyphal.centralized_allocator = CentralizedAllocator(state.cyphal.local_node)
                            state.cyphal.centralized_allocator.start()

                            def allocated_hook(allocated_node_id: int) -> None:
                                logger.debug("Handling allocation of node %d", allocated_node_id)
                                if new_mode == "Automatic persistent allocation":
                                    logger.debug("Now sending store persistent states to node %d", allocated_node_id)
                                    state.queues.god_queue.put_nowait(StorePersistentStatesRequest(allocated_node_id, 0.5))

                            state.cyphal.centralized_allocator.allocated_node_hooks.append(allocated_hook)

                            logger.info("Allocator is now running")
                        else:
                            logger.debug("Scheduled allocator to run when local node is set")

                    except:
                        logger.exception("Exception while running allocator")
                        tb = traceback.format_exc()
                        logger.error(tb)

                if (
                    not state.cyphal_worker_asyncio_loop
                    or not state.cyphal.local_node
                    or not state.cyphal.local_node.id  # This is fine to check because if state.cyphal.local_node was None then this condition wouldn't be checked
                ):
                    logger.debug("No asyncio loop, postponing allocator run")
                    state.callbacks["yukon_node_attached"].append(_run_allocator)
                else:
                    assert state.cyphal.local_node
                    assert state.cyphal.local_node.id
                    _run_allocator_inner()

            _run_allocator()
        elif new_mode == "Manual" and state.cyphal.centralized_allocator:
            logger.info("Allocator is now stopped")
            state.cyphal.centralized_allocator.close()
            state.cyphal.centralized_allocator = None