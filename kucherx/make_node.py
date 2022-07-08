from threading import Thread

from pycyphal.application.node_tracker import NodeTracker

from domain.KucherXState import KucherXState


def make_node(state: KucherXState):
    import asyncio
    event_loop_a = asyncio.new_event_loop()

    def _make_node():
        asyncio.set_event_loop(event_loop_a)
        import pycyphal
        import pycyphal.application
        state.settings.UAVCAN__CAN__BITRATE = str(state.settings.arbitration_bitrate) + " " + str(
            state.settings.data_bitrate)
        import dataclasses
        settings_dictionary = dataclasses.asdict(state.settings)
        new_settings_dictionary = {}
        for key, value in settings_dictionary.items():
            new_settings_dictionary[str(key).strip()] = str(value)
        registry = pycyphal.application.make_registry(environment_variables=new_settings_dictionary)
        from pycyphal.application import make_node
        from pycyphal.application import NodeInfo
        import uavcan
        state.local_node = make_node(NodeInfo(name="com.zubax.sapog.tests.debugger"), registry,
                                     reconfigurable_transport=True)
        state.local_node.presentation.transport.begin_capture(
            make_capture_handler(tracer, ids, log_to_file=with_debugging, log_to_print=with_debugging,
                                 debugger_id_for_filtering=debugger_node_id))
        state.tracker = NodeTracker(state.local_node)
        state.tracker.add_update_handler(make_handler_for_getinfo_update())
        state.tracer = state.local_node.presentation.transport.make_tracer()
        state.local_node.start()
        return state.local_node

    cyphal_thread = Thread(target=_make_node)
    cyphal_thread.start()
