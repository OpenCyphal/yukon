from typing import Any, NoReturn, Sequence
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
index_ref   = id "[" integer "]"
integer     = ~"[0-9]+"
"""
)


class FieldModifyingVisitor(NodeVisitor):
    def __init__(self, obj: object, value: Any):
        self._obj = obj
        self._value = value
        self._current_pointer = None

    @property
    def result(self) -> Any:
        return self._obj

    def visit_id(self, node, visited_children) -> None:
        visited_children = [c for c in visited_children if c is not None]
        if hasattr(self._obj, node.text):
            self._current_pointer = getattr(self._obj, node.text)
            print("Setting pointer to ", self._current_pointer)
        return_value = ("id", node.text)
        print(return_value, visited_children)
        return return_value

    def visit_attr_ref(self, node, visited_children) -> None:
        visited_children = [c for c in visited_children if c is not None]
        return_value = ("attr_ref", node.text)
        print(return_value, visited_children)
        return return_value

    def visit_index_ref(self, node, visited_children) -> None:
        visited_children = [c for c in visited_children if c is not None]
        index = visited_children[-1]
        assert index[0] == "integer"
        index = index[1]
        return_value = ("index_ref", node.text)
        print(return_value, visited_children)
        print("Setting value at index", index)
        return return_value

    def visit_integer(self, node, visited_children) -> None:
        return_value = ("integer", int(node.text))
        return return_value

    def generic_visit(self, node: Node, visited_children: Sequence[Any]) -> Any:
        return None


obj = Real32_1()
visitor = FieldModifyingVisitor(obj, 123.456)
print(f"Id of obj {id(obj.value)}")
visitor.visit(grammar.parse("value[5]"))
print(visitor.result)
