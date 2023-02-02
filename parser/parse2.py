import uavcan.node.Heartbeat_1_0
from parse_field_spec import FieldModifyingVisitor, grammar

obj = uavcan.node.Heartbeat_1_0()
visitor = FieldModifyingVisitor(obj, 3)
visitor.visit(grammar.parse("health.value"))
print(obj.health.value)
