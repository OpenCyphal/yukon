import pycyphal
from pycyphal.transport import (
    ProtocolParameters,
    InputSession,
    OutputSession,
    AlienTransfer,
    CaptureCallback,
    TransportStatistics,
    Tracer,
    PayloadMetadata,
    Transfer,
)
import typing
from typing import Optional, Sequence
from pycyphal.transport.udp import UDPTransport, UDPOutputSession, UDPInputSession


class FaultyTransport(pycyphal.transport.Transport):
    def __init__(self, inner: pycyphal.transport.Transport):
        self._inner = inner
        self._faulty = False

    @property
    def faulty(self) -> typing.Any:
        return self._faulty

    @faulty.setter
    def faulty(self, value: bool) -> None:
        self._faulty = value

    def get_input_session(
        self, specifier: pycyphal.transport.InputSessionSpecifier, payload_metadata: pycyphal.transport.PayloadMetadata
    ) -> InputSession:
        if self.faulty:
            return FaultyInputSession(self._inner.get_input_session(specifier, payload_metadata))
        else:
            return self._inner.get_input_session(specifier, payload_metadata)

    def get_output_session(
        self, specifier: pycyphal.transport.OutputSessionSpecifier, payload_metadata: pycyphal.transport.PayloadMetadata
    ) -> OutputSession:
        if self.faulty:
            return FaultyOutputSession(self._inner.get_output_session(specifier, payload_metadata))
        else:
            return self._inner.get_output_session(specifier, payload_metadata)

    def close(self) -> None:
        self.inner.close()

    @property
    def inner(self) -> typing.Any:
        return self._inner

    @property
    def protocol_parameters(self) -> typing.Any:
        return self._inner.protocol_parameters

    @property
    def local_node_id(self) -> typing.Any:
        return self._inner.local_node_id

    @property
    def input_sessions(self) -> typing.Any:
        return self._inner.input_sessions

    @property
    def output_sessions(self) -> typing.Any:
        return self._inner.output_sessions

    @property
    def capture_active(self) -> typing.Any:
        return self._inner.capture_active

    async def spoof(self, transfer: AlienTransfer, monotonic_deadline: float) -> typing.Any:
        return await self._inner.spoof(transfer, monotonic_deadline)

    def _get_repr_fields(self) -> typing.Any:
        return self._inner._get_repr_fields()

    def begin_capture(self, handler: CaptureCallback) -> None:
        self._inner.begin_capture(handler)

    @staticmethod
    def make_tracer() -> Tracer:
        raise NotImplementedError

    def sample_statistics(self) -> TransportStatistics:
        raise NotImplementedError


import random


class FaultySession:
    def should_fail(self) -> bool:
        return random.choice([True, False])


class FaultyInputSession(InputSession, FaultySession):
    def __init__(self, inner: InputSession):
        self._inner = inner

    @property
    def specifier(self) -> pycyphal.transport.InputSessionSpecifier:
        return self._inner._specifier

    def sample_statistics(self) -> TransportStatistics:
        raise NotImplementedError

    def receive(self, deadline: float) -> pycyphal.transport.Transfer:
        if self.should_fail():
            raise Exception("The transport is closed")
        else:
            return self._inner.receive(deadline)

    def close(self) -> None:
        self._inner.close()

    @property
    def payload_metadata(self) -> PayloadMetadata:
        return self._inner.payload_metadata

    @property
    def transfer_id_timeout(self) -> typing.Any:
        return self._inner.transfer_id_timeout


class FaultyOutputSession(OutputSession, FaultySession):
    def __init__(self, inner: OutputSession):
        self._inner = inner
        self._closed = False

    @property
    def specifier(self) -> pycyphal.transport.InputSessionSpecifier:
        return self._inner._specifier

    def sample_statistics(self) -> TransportStatistics:
        raise NotImplementedError

    async def send(self, transfer: Transfer, monotonic_deadline: float) -> typing.Any:
        if self.should_fail():
            raise Exception("The transport is closed")
        return await self._inner.send(transfer, monotonic_deadline)

    def close(self) -> None:
        self._inner.close()

    @property
    def payload_metadata(self) -> PayloadMetadata:
        return self._inner.payload_metadata

    @property
    def transfer_id_timeout(self) -> typing.Any:
        return self._inner.transfer_id_timeout

    def disable_feedback(self) -> typing.Any:
        return self._inner.disable_feedback()

    def enable_feedback(self) -> typing.Any:
        return self._inner.enable_feedback()
