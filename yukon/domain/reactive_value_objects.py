import sys
from typing import Any

import typing
import threading


class Connection:
    def __init__(self, callback: typing.Any) -> None:
        self._callback = callback
        self.destroyed = False
        self._reactive_value = None

    def disconnect(self) -> None:
        assert self._reactive_value is not None
        self.destroyed = True
        self._reactive_value.disconnect(self)

    def send(self, *args: typing.Optional[list], **kwargs: typing.Optional[dict]) -> None:
        self._callback(*args, **kwargs)


class ReactiveValue:
    def __init__(self, value: Any) -> None:
        self._value = value
        self._connections: list[Connection] = []
        self.parent = None
        self._hash = None
        self._child_hashes = None

    def connect(self, callback: typing.Any) -> Connection:
        connection = Connection(callback)
        self._connections.append(connection)
        return connection

    def bubble_react(self, reactive_value: "ReactiveValue") -> None:
        if isinstance(self._value, list):
            # Fill in the child hashes
            self._child_hashes = []
            for value in self._value:
                if isinstance(value, ReactiveValue):
                    self._child_hashes.append(value.hash)
                else:
                    self._child_hashes.append(hash(value))
        elif isinstance(self._value, dict):
            # Fill in the child hashes
            self._child_hashes = []
            for _, value in sorted(self._value.items()):
                if isinstance(value, ReactiveValue):
                    self._child_hashes.append(value.hash)
                else:
                    self._child_hashes.append(hash(value))
        elif isinstance(self._value, (int, float, str, bool)):
            self._child_hashes = None
        for connection in self._connections:
            connection.send(reactive_value.value)
        if self.parent:
            self.parent.bubble(reactive_value)

    def __contains__(self, item: typing.Any):
        # If the hash of the item is in the child hashes, then it is contained in the reactive value
        if self._child_hashes is None:
            return False
        return hash(item) in self._child_hashes

    def __hash__(self) -> int:
        if isinstance(self._value, dict):
            # Take all the hashes of the values in the dictionary, add them together and hash them
            # Make sure to sort by keys first
            hashes = []
            for _, value in sorted(self._value.items()):
                if isinstance(value, ReactiveValue):
                    hashes.append(value.hash)
                else:
                    hashes.append(hash(value))
            self._hash = hash(hashes)
            return self._hash
        elif isinstance(self._value, (int, float, str, bool)):
            self._hash = hash(self._value)
            return self._hash
        elif isinstance(self._value, list):
            hashes = []
            for value in self._value:
                if isinstance(value, ReactiveValue):
                    hashes.append(value.hash)
                else:
                    hashes.append(hash(value))
            self._hash = hash(hashes)
            return self._hash
        return self._hash

    def __eq__(self, other: typing.Any) -> bool:
        if isinstance(other, ReactiveValue):
            return self.hash == other.hash
        return self._value == other

    def disconnect(self, connection: Connection) -> None:
        self._connections.remove(connection)

    @property
    def hash(self) -> typing.Any:
        if not self.hash:
            self.__hash__()
        return self.hash

    @property
    def value(self) -> typing.Any:
        return self._value

    @value.setter
    def value(self, value: Any) -> None:
        if self._value != value:
            self.bubble_react(self)
            self._value = value

    def __str__(self) -> str:
        return str(self.value)

    def __repr__(self) -> str:
        if len(str(self.value)) > 30:
            return f"ReactiveValue({str(self.value)[:30]}...)"
        return "ReactiveValue({})".format(self.value)

    # Implement methods from https://docs.python.org/3/reference/datamodel.html#emulating-numeric-types
    # use the self._value as the underlying value
