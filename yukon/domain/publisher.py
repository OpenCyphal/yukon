import typing
import json
from uuid import uuid4

import pycyphal.dsdl
import pycyphal.application
from yukon.domain.publish_value_generator import StaticPublishValueGenerator
from yukon.domain.subject_specifier import SubjectSpecifier
from yukon.services.dtype_loader import load_dtype

Builtin = typing.Union[typing.Dict, typing.List]


class YukonPublisher:
    def __init__(self, node: pycyphal.application.Node, subject_specifiers: typing.List[SubjectSpecifier]):
        self.node = node
        self.subject_specifiers = subject_specifiers
        self._loaded_datatypes: typing.Dict[SubjectSpecifier, typing.Any] = {}
        self._loaded_datatype_structures: typing.Dict[SubjectSpecifier, typing.Any] = {}
        self._loaded_datatype_values: typing.Dict[SubjectSpecifier, typing.Any] = {}
        self.publishers: typing.Dict[SubjectSpecifier, pycyphal.presentation.Publisher] = {}
        self.id = uuid4()
        for subject_specifier in self.subject_specifiers:
            self._fill_data_for_specifier(subject_specifier)

    @staticmethod
    def from_specifier_value_dictionary(
        node: pycyphal.application.Node,
        specifiers_with_values: typing.Dict[SubjectSpecifier, Builtin],
    ):
        new_publisher = YukonPublisher(node, list(specifiers_with_values.keys()))
        for specifier, value in specifiers_with_values.items():
            new_publisher.update_value(specifier, json.dumps(value))

    def _fill_data_for_specifier(self, subject_specifier: SubjectSpecifier):
        self._loaded_datatypes[str(subject_specifier)] = load_dtype(self.datatype)
        self._loaded_datatype_structures[str(subject_specifier)] = pycyphal.dsdl.to_builtin(
            self._loaded_datatypes[str(subject_specifier)]()
        )
        self.set_datatype_value(subject_specifier, json.dumps(self._loaded_datatype_structures[str(subject_specifier)]))
        self.publishers[subject_specifier] = self.node.make_publisher()

    def add_subject_specifier(self, subject_specifier: SubjectSpecifier):
        self.subject_specifiers.append(subject_specifier)
        self._fill_data_for_specifier(subject_specifier)

    def update_value(self, subject_specifier: SubjectSpecifier, value: Builtin) -> None:
        datatype_value_object = value
        datatype_class_value_object = self._loaded_datatypes[str(subject_specifier)]()
        pycyphal.dsdl.update_from_builtin(datatype_class_value_object, datatype_value_object)
        self._loaded_datatype_values[subject_specifier] = datatype_class_value_object

    def get_value(self, subject_specifier: SubjectSpecifier) -> typing.Any:
        return pycyphal.dsdl.to_builtin(self._loaded_datatype_values[subject_specifier])

    def publish(self):
        for publisher in self.publishers:
            publisher.publish(self._loaded_datatype_values[publisher.subject_specifier])

    def __str__(self):
        """List all the specifiers and all in _loaded_datatype_values but first run"""
        return f"YukonPublisher: {self.id} - {self.subject_specifiers}"

    def __repr__(self):
        all_values = [self.get_value(x) for x in self.subject_specifiers]
        return self.__str__() + "- \n" + json.dumps(all_values)
