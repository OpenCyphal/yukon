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
        self._child_hashes = None

    def connect(self, callback: typing.Any) -> Connection:
        connection = Connection(callback)
        self._connections.append(connection)
        return connection

    def __getitem__(self, item: typing.Any) -> typing.Any:
        if isinstance(self._value, dict):
            return self._value[item]
        elif isinstance(self._value, list):
            # Only every even index is a real value, the odd indexes are their ids
            return self._value[item * 2]
        else:
            return None

    def get(self, item: typing.Any, default: typing.Any = None) -> typing.Any:
        if isinstance(self._value, dict):
            return self._value.get(item, default)
        elif isinstance(self._value, list):
            # Only every even index is a real value, the odd indexes are their ids
            return self._value[item * 2]
        else:
            return None

    def get_child_by_id(self, id: str) -> typing.Any:
        if isinstance(self._value, dict):
            # Find the value that contains the id
            # Make sure that the key contains __id__
            # The part of the key that comes after __id__ is the key of the value that needs to be returned
            for key, value in self._value.items():
                if key.startswith("__id__"):
                    if str(value) == id:
                        return self._value[key[6:]]
        elif isinstance(self._value, list):
            # Look through the even indexes to find the id
            # The next index is the value that needs to be returned
            for i in range(1, len(self._value), 2):
                if str(self._value[i]) == id:
                    return self._value[i + 1]
        return None

    def get_descendant_with_id(self, id: str) -> typing.Any:
        # Use get_child_by_id and recurse through the children
        def find_in_value(value: typing.Any) -> typing.Any:
            if isinstance(value, ReactiveValue):
                if isinstance(value.value, list):
                    if str(value.value[0]) == id:
                        return value
                elif isinstance(value.value, dict):
                    if str(value.value["__id__"]) == id:
                        return value
                search_result = value.get_child_by_id(id)
                if search_result:
                    return search_result
                search_result2 = value.get_descendant_with_id(id)
                if search_result2:
                    return search_result2
            return None

        if isinstance(self._value, dict):
            for _, value in self._value.items():
                return_value = find_in_value(value)
                if return_value:
                    return return_value
        elif isinstance(self._value, list):
            for value in self._value:
                return_value = find_in_value(value)
                if return_value:
                    return return_value
        return None

    def remove_descendant_with_id(self, id: str) -> typing.Any:
        """Remove and return the descendant that matches this id.

        get_descendant_with_id is used to find the descendant.

        For lists the value is removed from the list.

        For dicts the value is removed from the dict.
        """
        descendant = self.get_descendant_with_id(id)
        if descendant:
            # If the parent is a list, remove the value from the list
            if isinstance(descendant.parent._value, list):
                # Find the index of the guid value
                guid_index = descendant.parent._value.index(id)
                # Pop the id and the value
                descendant.parent._value.pop(guid_index)
                # Because of the pop and shift of elements,
                # the element before the guid is now -1 index of original
                descendant.parent._value.pop(guid_index - 1)
            # If the parent is a dict, remove the value from the dict
            elif isinstance(descendant.parent._value, dict):
                # Find the key that contains the id
                for key, value in descendant.parent._value.items():
                    if value == id:
                        real_key = key[6:]
                        del descendant.parent._value[key]
                        del descendant.parent._value[real_key]
                        break
        return descendant

    def bubble_react(self, reactive_value: "ReactiveValue") -> None:
        for connection in self._connections:
            connection.send(reactive_value.value)
        if self.parent:
            self.parent.bubble_react(reactive_value)

    def do_self_or_children_have_listeners(self) -> bool:
        if self._connections:
            return True
        if isinstance(self._value, list):
            for value in self._value:
                if isinstance(value, ReactiveValue):
                    if value.do_self_or_children_have_listeners():
                        return True
        elif isinstance(self._value, dict):
            for _, value in self._value.items():
                if isinstance(value, ReactiveValue):
                    if value.do_self_or_children_have_listeners():
                        return True
        return False

    def disconnect(self, connection: Connection) -> None:
        self._connections.remove(connection)

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
