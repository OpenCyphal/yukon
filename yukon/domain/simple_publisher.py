import typing

from yukon.domain.publisher_field import PublisherField


class SimplePublisher:
    def __init__(self, _id: str):
        self.id = _id
        self.name = ""
        self.fields: typing.Dict[str, PublisherField] = {}
