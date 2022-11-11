from typing import Any


class Connection:
    def __init__(self, callback) -> None:
        self._callback = callback
        self.destroyed = False
        self._reactive_value = None

    def disconnect(self) -> None:
        assert self._reactive_value is not None
        self.destroyed = True
        self._reactive_value.disconnect(self)

    def send(self, *args, **kwargs) -> None:
        self._callback(*args, **kwargs)


class ReactiveValue:
    def __init__(self, value: Any) -> None:
        self._value = value
        self._connections: list[Connection] = []

    def connect(self, callback) -> Connection:
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

    @property
    def value(self):
        return self._value

    @value.setter
    def value(self, value: int) -> None:
        self.set(value)

    def __str__(self) -> str:
        return str(self._value)

    # Implement methods from https://docs.python.org/3/reference/datamodel.html#emulating-numeric-types
    # use the self._value as the underlying value
