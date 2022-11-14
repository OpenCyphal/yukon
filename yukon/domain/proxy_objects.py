from typing import Any

import typing


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

    def connect(self, callback: typing.Any) -> Connection:
        connection = Connection(callback)
        self._connections.append(connection)
        return connection

    def disconnect(self, connection: Connection) -> None:
        self._connections.remove(connection)

    def set(self, value: Any) -> None:
        self._value = value
        for connection in self._connections:
            connection.send(value)

    def get(self) -> Any:
        return self._value

    def __str__(self) -> str:
        return str(self._value)

    # Implement methods from https://docs.python.org/3/reference/datamodel.html#emulating-numeric-types
    # use the self._value as the underlying value
