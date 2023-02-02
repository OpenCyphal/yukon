import uavcan.node.port.List_0_1
from parse_field_spec import FieldModifyingVisitor, grammar

obj = uavcan.node.port.List_0_1()
visitor = FieldModifyingVisitor(obj, 3)
visitor.visit(grammar.parse("publishers.sparse_list[0].value"))
print(obj.publishers.sparse_list[0].value)
