# Copyright (c) 2019 OpenCyphal
# This software is distributed under the terms of the MIT License.
# Author: Pavel Kirienko <pavel@opencyphal.org>
from typing import Any, Optional
import pycyphal
from pycyphal.application.register import Value, Empty, Integer8, Natural8, Integer32, String, Unstructured


def unexplode_value(xpl: Any, prototype: Optional[Value] = None) -> Optional["Value"]:
    """
    Reverse the effect of :func:`explode`.
    Returns None if the exploded form is invalid or not applicable to the prototype.
    Some simplified exploded forms can be unexploded only if the prototype
    is given because simplification erases type information.
    Some unambiguous simplified forms may be unexploded autonomously.
    >>> from pycyphal.application.register import Value, Natural16
    >>> ux = unexplode_value
    >>> ux(None)                                         # None is a simplified form of Empty.
    uavcan.register.Value...(empty=...)
    >>> ux({"integer8": {"value": [1,2,3]}, "_meta_": {"whatever": 0}})  # Metadata ignored.
    uavcan.register.Value...(integer8=...[1,2,3]))
    >>> ux({"integer8": {"value": [1,2,3]}})             # Pure Value (same as above)
    uavcan.register.Value...(integer8=...[1,2,3]))
    >>> ux([1,2,3]) is None                              # Prototype required.
    True
    >>> ux([1,2,3], Value(natural16=Natural16([0,0,0])))
    uavcan.register.Value...(natural16=...[1,2,3]))
    >>> ux(123, Value(natural16=Natural16([0])))
    uavcan.register.Value...(natural16=...[123]))
    >>> ux("abc", Value(natural16=Natural16([0]))) is None # Not applicable
    True
    Roundtrip:
    >>> unexplode_value(explode_value(Value(natural16=Natural16([0,1,2])), metadata={"a": 654}))
    uavcan.register.Value...(natural16=...[0,1,2]))
    """
    from pycyphal.dsdl import update_from_builtin
    from pycyphal.application.register import ValueProxy, Value, ValueConversionError

    if xpl is None:
        return Value()
    if isinstance(xpl, dict) and xpl:  # Empty dict is not a valid representation.
        try:
            res = update_from_builtin(
                Value(),
                {k: v for k, v in xpl.items() if k.strip("_") == k},  # Strip metadata fields.
            )
            assert isinstance(res, Value)
            return res
        except (ValueError, TypeError):
            pass
    if prototype is not None:
        if prototype.unstructured:
            if isinstance(xpl, str):
                return Value(unstructured=Unstructured(bytes.fromhex(xpl)))
        ret = ValueProxy(prototype)
        try:
            ret.assign(xpl)
            assert isinstance(ret.value, Value)
            return ret.value
        except ValueConversionError:
            pass
    return None


def explode_value(val: "Value", *, simplify: bool = False, metadata: dict[str, Any] | None = None) -> Any:
    """
    Represent the register value using primitives (list, dict, string, etc.).
    If simplified mode is selected,
    the metadata and type information will be discarded and only a human-friendly representation of the
    value will be constructed.
    The reconstruction back to the original form is a bit involved but we provide :func:`unexplode` for that.
    The metadata is added under a key ``_meta_``, if there is any, but it is ignored in simplified mode.
    """
    if not simplify:
        out = pycyphal.dsdl.to_builtin(val)
        if metadata is not None:
            out["_meta_"] = dict(metadata)
        return out
    return _simplify_value(val)


def _simplify_value(msg: "Value") -> Any:
    """
    Construct simplified human-friendly representation of the register value using primitives (list, string, etc.).
    Designed for use with commands that output compact register values in YAML/JSON/TSV/whatever,
    discarding the detailed type information.
    >>> from pycyphal.application.register import Value, Empty
    >>> from pycyphal.application.register import Integer8, Natural8, Integer32, String, Unstructured
    >>> None is _simplify_value(Value())  # empty is none
    True
    >>> _simplify_value(Value(integer8=Integer8([123])))
    123
    >>> _simplify_value(Value(natural8=Natural8([123, 23])))
    [123, 23]
    >>> _simplify_value(Value(integer32=Integer32([123, -23, 105])))
    [123, -23, 105]
    >>> _simplify_value(Value(integer32=Integer32([99999])))
    99999
    >>> _simplify_value(Value(string=String("Hello world")))
    'Hello world'
    >>> _simplify_value(Value(unstructured=Unstructured(b"Hello world")))
    b'Hello world'
    """
    # This is kinda crude, perhaps needs improvement.
    if msg.empty:
        return None
    if msg.unstructured:
        return msg.unstructured.value.tobytes().hex()  # FIXME update the unexploder accordingly
    if msg.string:
        return msg.string.value.tobytes().decode(errors="replace")
    ((_ty, val),) = pycyphal.dsdl.to_builtin(msg).items()
    val = val["value"]
    val = list(val.encode() if isinstance(val, str) else val)
    if len(val) == 1:  # One-element arrays shown as scalars.
        (val,) = val
    return val
