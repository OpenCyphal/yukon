import dataclasses
import inspect
import json
import logging
from json.encoder import encode_basestring_ascii, encode_basestring, c_make_encoder, _make_iterencode  # type: ignore
import typing
from uuid import UUID

import pycyphal

import uavcan
from yukon.domain.subscriptions.message_carrier import MessageCarrier
from yukon.domain.reactive_proxy_objects import ReactiveValue
from yukon.domain.subscriptions.synchronized_message_carrier import SynchronizedMessageCarrier

from yukon.services.value_utils import explode_value
from yukon.domain.transport.attach_transport_response import AttachTransportResponse
from yukon.domain.registers.update_register_log_item import UpdateRegisterLogItem
from yukon.domain.interface import Interface
from yukon.domain.transport.detach_transport_response import DetachTransportResponse

INFINITY = float("inf")

_logger = logging.getLogger(__name__)
# _logger.setLevel(logging.DEBUG)


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, o: typing.Any) -> typing.Any:
        if "save_settings" in [x[3] for x in inspect.stack()]:
            _logger.debug("Coming from save_settings")
        _logger.debug("Serializing %r: %r", type(o), o)
        if isinstance(o, ReactiveValue):
            if isinstance(o.value, ReactiveValue):
                _logger.warning("ReactiveValue contains ReactiveValue")
                raise TypeError("ReactiveValue contains ReactiveValue")
            if isinstance(o.value, (float, int, str, bool)):
                return o.value
            else:
                raise TypeError("ReactiveValue contains unsupported type %r", type(o.value))
        if isinstance(o, UUID):
            return str(o)
        if isinstance(o, MessageCarrier):
            metadata = o.metadata
            metadata["counter"] = o.counter
            return {
                o.subject_id: {
                    "message": o.message,
                    "_meta_": metadata,
                }
            }
        if isinstance(o, SynchronizedMessageCarrier):
            metadata = o.metadata
            metadata["counter"] = o.counter
            metadata["subject_id"] = o.subject_id
            return {
                o.subject_id: {
                    "message": o.message,
                    "_meta_": metadata,
                }
            }
        if isinstance(o, DetachTransportResponse):
            return {
                "is_success": o.is_success,
                "interface_disconnected": o.interface_disconnected,
                "message": o.message,
            }
        if isinstance(o, Interface):
            return {
                "iface": o.iface,
                "mtu": o.mtu,
                "rate_data": o.rate_data,
                "rate_arb": o.rate_arb,
                "is_udp": o.is_udp,
                "udp_iface": o.udp_iface,
                "udp_mtu": o.udp_mtu,
                "hash": str(o.__hash__()),
            }
        if isinstance(o, AttachTransportResponse):
            return {
                "is_success": o.is_success,
                "message": o.message,
                "message_short": o.message_short,
            }
        if isinstance(o, uavcan.register.Value_1):
            verification_exploded_value = explode_value(
                o,
                simplify=True,
            )
            verification_exploded_value_str = json.dumps(verification_exploded_value, cls=EnhancedJSONEncoder)
            return verification_exploded_value_str
        # If the object contains a _serialize_ method then
        if dataclasses.is_dataclass(o):
            return dataclasses.asdict(o)
        if hasattr(o, "_serialize_"):
            pycyphal.dsdl.to_builtin(o)
        return super().default(o)

    def iterencode(self, o: typing.Any, _one_shot: bool = False) -> typing.Any:
        """Encode the given object and yield each string
        representation as available.

        For example::

            for chunk in JSONEncoder().iterencode(bigobject):
                mysocket.write(chunk)

        """
        if self.check_circular:
            markers: typing.Any = {}
        else:
            markers = None
        if self.ensure_ascii:
            _encoder = encode_basestring_ascii
        else:
            _encoder = encode_basestring

        def floatstr(
            o: typing.Any,
            allow_nan: bool = self.allow_nan,
            _repr: typing.Any = float.__repr__,
            _inf: typing.Any = INFINITY,
            _neginf: typing.Any = -INFINITY,
        ) -> typing.Any:
            # Check for specials.  Note that this type of test is processor
            # and/or platform-specific, so do tests which don't depend on the
            # internals.

            if o != o:
                text = '"NaN"'
            elif o == _inf:
                text = '"Infinity"'
            elif o == _neginf:
                text = '"-Infinity"'
            else:
                return _repr(o)

            if not allow_nan:
                raise ValueError("Out of range float values are not JSON compliant: " + repr(o))

            return text

        # if (_one_shot and c_make_encoder is not None
        #         and self.indent is None):
        #     _iterencode = c_make_encoder(
        #         markers, self.default, _encoder, self.indent,
        #         self.key_separator, self.item_separator, self.sort_keys,
        #         self.skipkeys, self.allow_nan)
        # else:
        _iterencode = _make_iterencode(
            markers,
            self.default,
            _encoder,
            self.indent,
            floatstr,
            self.key_separator,
            self.item_separator,
            self.sort_keys,
            self.skipkeys,
            _one_shot,
        )
        return _iterencode(o, 0)

    def encode(self, o: typing.Any) -> typing.Any:
        """Return a JSON string representation of a Python data structure.

        >>> from json.encoder import JSONEncoder
        >>> JSONEncoder().encode({"foo": ["bar", "baz"]})
        '{"foo": ["bar", "baz"]}'

        """
        # This is for extremely simple cases and benchmarks.
        if isinstance(o, str):
            if self.ensure_ascii:
                return encode_basestring_ascii(o)
            else:
                return encode_basestring(o)
        if isinstance(o, UUID):
            return str(o)
        # This doesn't pass the iterator directly to ''.join() because the
        # exceptions aren't as detailed.  The list call should be roughly
        # equivalent to the PySequence_Fast that ''.join() would do.
        chunks = self.iterencode(o, _one_shot=True)
        if not isinstance(chunks, (list, tuple)):
            chunks = list(chunks)
        return "".join(chunks)
