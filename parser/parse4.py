import typing
import numpy as np
import uavcan.node.port.List_0_1
import pycyphal.dsdl
import pydsdl

from yukon.services.dtype_loader import load_dtype


def modify(obj, path, value):
    split_path = path.split(".")
    objects = [obj]
    current_object = obj
    previous_object = obj

    def get_index(string: str) -> int:
        return int(string.split("[")[1].split("]")[0])

    def get_id(string: str) -> str:
        return string.split("[")[0]

    def get_type_of_primitive(type_string):
        if type_string == "saturated bool":
            return bool
        elif "int" in type_string:
            return int
        elif "float" in type_string:
            return float
        else:
            print(f"Unknown type {type_string}")
            assert False

    def check_and_potentially_fill_model(current: typing.Any, _id, index: typing.Optional[int]):
        model: pydsdl.CompositeType = pycyphal.dsdl.get_model(current)[_id]
        if isinstance(model.data_type, (pydsdl.VariableLengthArrayType, pydsdl.FixedLengthArrayType)):
            array_type = typing.cast(pydsdl.ArrayType, model.data_type)
            try:
                # This doesn't work for primitive types, only works for CompositeTypes
                element_type_name: str = array_type.element_type.full_name
                element_type = load_dtype(element_type_name)
            except:
                element_type_name = str(array_type.element_type)
                element_type = get_type_of_primitive(element_type_name)
            # If the array is empty, fill it with instances of the element type
            if getattr(current, _id) is None:
                array_filled_with_correct_datatype = np.array([element_type() for i in range(index + 1)], dtype=object)
                setattr(current, _id, array_filled_with_correct_datatype)
            elif len(getattr(current, _id)) <= index:
                # Fill the missing indices with instances of the element type
                array = getattr(current, _id)
                array_filled_with_correct_datatype = np.array(
                    [element_type() for i in range(len(array), index + 1)], dtype=object
                )
                setattr(current, _id, np.append(array, array_filled_with_correct_datatype))
        else:
            data_type_name = model.data_type.TYPE_NAME
            data_type = load_dtype(data_type_name)
            setattr(current, _id, data_type())

    def access_on_object(current, access_string, history_tracking=False):
        nonlocal current_object, previous_object, objects
        if "[" in access_string:
            index = get_index(access_string)
            _id = get_id(access_string)
            check_and_potentially_fill_model(current, _id, index)
            _array = getattr(current, _id)

            _current_object = _array[index]
            if history_tracking:
                previous_object = current_object
                current_object = _current_object
                objects.append(current_object)
            return _current_object
        else:
            _current_object = getattr(current, access_string)
            if _current_object is None:
                check_and_potentially_fill_model(current, access_string, None)
            if history_tracking:
                previous_object = current_object
                current_object = _current_object
                objects.append(current_object)
            return _current_object

    def set_on_object(current, access_string, value):
        if "[" in access_string:
            index = get_index(access_string)
            _id = get_id(access_string)
            array = getattr(current, _id)
            # Check if the array has enough space
            if len(array) <= index:
                array = np.append(array, np.zeros(index - len(array) + 1))
                array[index] = value
                setattr(current, _id, array)
            else:
                array[index] = value
                setattr(current, _id, array)
        else:
            setattr(current, access_string, value)

    for i in range(len(split_path)):
        access_on_object(current_object, split_path[i], True)

    if isinstance(objects[-2], np.ndarray):
        set_on_object(objects[-3], split_path[-2])
    else:
        set_on_object(objects[-2], split_path[-1], value)

    return obj


obj = uavcan.node.port.List_0_1()
modify(obj, "publishers.sparse_list[125].value", 3)
modify(obj, "publishers.sparse_list[10].value", 123)
assert obj.publishers.sparse_list[10].value == 123
assert obj.publishers.sparse_list[125].value == 3

import uavcan.node.Heartbeat_1_0

obj = uavcan.node.Heartbeat_1_0()
modify(obj, "uptime", 123)
assert obj.uptime == 123

import uavcan.node.IOStatistics_0_1

obj = uavcan.node.IOStatistics_0_1()
modify(obj, "num_emitted", 123)
modify(obj, "num_received", 123)

assert obj.num_emitted == 123
assert obj.num_received == 123

import uavcan.primitive.array.Integer64_1_0

obj = uavcan.primitive.array.Integer64_1_0()
modify(obj, "value[0]", 123)
modify(obj, "value[1]", 123)

assert obj.value[0] == 123
assert obj.value[1] == 123

obj = uavcan.primitive.array.Real64_1_0()
modify(obj, "value[0]", 12.53)
modify(obj, "value[1]", 43.2)

assert obj.value[0] == 12.53
assert obj.value[1] == 43.2


import uavcan.primitive.array.Bit_1_0

obj = uavcan.primitive.array.Bit_1_0()
modify(obj, "value[0]", True)
modify(obj, "value[1]", True)
modify(obj, "value[2]", True)
modify(obj, "value[3]", True)
modify(obj, "value[4]", True)
modify(obj, "value[5]", True)
modify(obj, "value[6]", True)
modify(obj, "value[7]", True)
assert obj.value[0] == True
assert obj.value[1] == True
assert obj.value[2] == True
assert obj.value[3] == True
assert obj.value[4] == True
assert obj.value[5] == True
assert obj.value[6] == True
assert obj.value[7] == True
try:
    _ = obj.value[8]
except IndexError:
    pass
else:
    assert False
