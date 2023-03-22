import asyncio
import time
import traceback
import typing
import logging
import numpy as np

import pydsdl
import pycyphal

import yukon
from yukon.services.dtype_loader import FormatError, load_dtype

logger = logging.getLogger(__name__)

from yukon.domain.publisher_field import PublisherField


class SimplePublisher:
    def __init__(self, _id: str, state: "yukon.domain.god_state.GodState"):
        self.id = _id
        self.name = ""
        self._datatype = ""
        self.fields: typing.Dict[str, PublisherField] = {}
        self.rate_per_second = 1
        self.enabled = False
        self.state = state
        self.publisher: typing.Optional[pycyphal.presentation.Publisher] = None
        self.port_id: typing.Optional[int] = None

    @property
    def enabled(self) -> bool:
        return self._enabled

    @enabled.setter
    def enabled(self, value: bool) -> None:
        self._enabled = value

    @property
    def datatype(self) -> str:
        return self._datatype

    @datatype.setter
    def datatype(self, value: str) -> None:
        self._datatype = value
        loaded_temporary_type = pycyphal.dsdl.get_model(load_dtype(value))
        print(loaded_temporary_type)
        if loaded_temporary_type.has_fixed_port_id and loaded_temporary_type.fixed_port_id:
            self.port_id = loaded_temporary_type.fixed_port_id
            print("Assigned fixed port id: " + str(self.port_id))

    def assemble_publish_object(self) -> typing.Any:
        # First create an empty object of the correct type
        actual_datatype_class = load_dtype(self._datatype)
        publish_object = actual_datatype_class()

        return publish_object

    async def publish(self) -> None:
        if not self.port_id:
            logger.warning("Cannot publish without a port id")
            return

        if not self.publisher:
            logger.warning("Cannot publish without a publisher for port id %d", str(self.port_id))
            return
        start = time.monotonic()
        publish_object = self.assemble_publish_object()
        for field in self.fields.values():
            modify(publish_object, field.field_specifier, field.value)

        if self.publisher:
            # print(time.monotonic(), "Told to publish")
            result = await self.publisher.publish(publish_object)
            if not result:
                logger.error("Publish failed")

    def add_field(self, id: str) -> PublisherField:
        self.fields[id] = PublisherField(id)
        return self.fields[id]

    def get_field(self, id: str) -> PublisherField:
        return self.fields[id]

    def delete_field(self, id: str) -> None:
        del self.fields[id]


def modify(obj: typing.Any, path: str, value: str) -> typing.Any:
    if path == "":
        return obj
    start_time = time.monotonic()
    split_path = path.split(".")
    objects = [obj]
    current_object = obj
    previous_object = obj

    def get_index(string: str) -> int:
        return int(string.split("[")[1].split("]")[0])

    def get_id(string: str) -> str:
        return string.split("[")[0]

    def get_type_of_primitive(type_string: str) -> typing.Any:
        if type_string == "saturated bool":
            return bool
        elif "int" in type_string:
            return int
        elif "float" in type_string:
            return float
        else:
            print(f"Unknown type {type_string}")
            assert False

    def check_and_potentially_fill_model(current: typing.Any, _id: str, index: typing.Optional[int]) -> typing.Any:
        model: pydsdl.CompositeType = pycyphal.dsdl.get_model(current)[_id]
        if isinstance(model.data_type, (pydsdl.VariableLengthArrayType, pydsdl.FixedLengthArrayType)):
            if not index:
                index = 0
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
            try:
                data_type = load_dtype(data_type_name)
            except FormatError as e:
                # model.data_type is most likely a primtive datatype and what it contains needs no instantiation, it is not expected to contain a null value.
                tb = traceback.format_exc()
                logger.error("There was a FormatError, %s", tb)
                pass
            setattr(current, _id, data_type())

    def access_on_object(current: typing.Any, access_string: str, history_tracking: bool = False) -> typing.Any:
        nonlocal current_object, previous_object, objects
        try:
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
                try:
                    _current_object = getattr(current, access_string)
                except AttributeError:
                    print(f"Could not access {access_string} on {current}")
                if _current_object is None:
                    check_and_potentially_fill_model(current, access_string, None)
                if history_tracking:
                    previous_object = current_object
                    current_object = _current_object
                    objects.append(current_object)
                return _current_object
        except AttributeError:
            print(f"Could not access {access_string} on {current}")
            raise

    def set_on_object(current: typing.Any, access_string: str, value: typing.Any) -> None:
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
        set_on_object(objects[-3], split_path[-2], value)
    else:
        set_on_object(objects[-2], split_path[-1], value)

    return obj
