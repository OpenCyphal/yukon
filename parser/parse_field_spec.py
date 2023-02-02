from typing import Any, NoReturn, Sequence
import typing
from parsimonious import NodeVisitor
from parsimonious.nodes import Node
from parsimonious.grammar import Grammar
from uavcan.primitive.array import Real32_1
import numpy as np

# parsimonious.exceptions.IncompleteParseError: Rule 'id' matched in its entirety, but it didn't consume all the text. The non-matching portion of the text begins with '.bar[42]' (line 1, column 4).
# How do I fix?

grammar = Grammar(
    """
expr        = attr_ref / index_ref / id
id          = ~"[a-zA-Z_][a-zA-Z0-9_]*"
attr_ref    = id "." expr
index_ref   = (id "[" integer "]" "." expr) / (id "[" integer "]")
integer     = ~"[0-9]+"
"""
)


class FieldModifyingVisitor(NodeVisitor):
    def __init__(self, obj: object, value: Any):
        self._obj = obj
        self._value = value
        self.current_pointer = self._obj
        self.previous_pointer = self._obj
        self.last_index = None
        self.identifiers = []

    @property
    def result(self) -> Any:
        return self._obj

    def visit_id(self, node, visited_children) -> typing.Tuple[str, str]:
        # visited_children = [c for c in visited_children if c is not None]
        if hasattr(self._obj, node.text):
            self.current_pointer = getattr(self._obj, node.text)
            print("Setting pointer to ", self.current_pointer)
        return_value = ("id", node.text)
        self.identifiers.append(node.text)
        print(return_value, visited_children)
        return return_value

    def visit_attr_ref(self, node, visited_children) -> typing.Tuple[str, str]:
        # visited_children = [c for c in visited_children if c is not None]
        identifier = self.identifiers[-1]
        self.previous_pointer = self.current_pointer
        self.current_pointer = getattr(self.current_pointer, identifier)
        return_value = ("attr_ref", node.text)
        print(return_value, visited_children)
        return return_value

    def visit_index_ref(self, node, visited_children) -> typing.Tuple[str, str]:
        # visited_children = [c for c in visited_children if c is not None]
        index = self.last_index
        identifier = self.identifiers[-1]

        # Resize the numpy array at current_pointer
        if isinstance(self.current_pointer, np.ndarray):
            setattr(self.previous_pointer, identifier, np.resize(self.current_pointer, index + 1))
            self.current_pointer = getattr(self.previous_pointer, identifier)
            self.current_pointer[index] = self._value
        return_value = ("index_ref", node.text)
        print(return_value, visited_children)
        print("Setting value at index", index)
        return return_value

    def visit_integer(self, node, visited_children) -> typing.Tuple[str, str]:
        return_value = ("integer", int(node.text))
        self.last_index = int(node.text)
        return return_value

    def generic_visit(self, node: Node, visited_children: Sequence[Any]) -> Any:
        return visited_children or node


if __name__ == "__main__":
    obj = Real32_1()
    visitor = FieldModifyingVisitor(obj, 123.456)
    visitor2 = FieldModifyingVisitor(obj, 456)
    print(f"Id of obj {id(obj.value)}")
    visitor.visit(grammar.parse("value[2]"))
    print(f"Id of current pointer after visitor {id(visitor.current_pointer)}")
    visitor2.visit(grammar.parse("value[5]"))
    print(f"Id of current pointer after visitor2 {id(visitor2.current_pointer)}")
    print(obj)
