from CyphalLocalNodeSettings import CyphalLocalNodeSettings
from threading import Thread


def make_node(settings: CyphalLocalNodeSettings):
    import asyncio
    event_loop_a = asyncio.new_event_loop()

    def _make_node():
        asyncio.set_event_loop(event_loop_a)
        import pycyphal
        import pycyphal.application
        settings.UAVCAN__CAN__BITRATE = str(settings.arbitration_bitrate) + " " + str(settings.data_bitrate)
        import dataclasses
        settings_dictionary = dataclasses.asdict(settings)
        new_settings_dictionary = {}
        for key, value in settings_dictionary.items():
            new_settings_dictionary[str(key).strip()] = str(value)
        registry = pycyphal.application.make_registry(environment_variables=new_settings_dictionary)
        # transport = pycyphal.application.make_transport(registers=registry, reconfigurable=True)
        from pycyphal.application import make_node
        from pycyphal.application import NodeInfo
        node = make_node(NodeInfo(name="com.zubax.sapog.tests.debugger"), registry)
        node.start()
        return node

    cyphal_thread = Thread(target=_make_node)
    cyphal_thread.start()
