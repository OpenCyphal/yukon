import typing

from yukon.domain.publisher_field import PublisherField


class SimplePublisher:
    def __init__(self, _id: str):
        self.id = _id
        self.name = ""
        self.fields: typing.Dict[str, PublisherField] = {}
        self.rate_per_second = 1
        self.enabled = False

    def add_field(self, id: str) -> PublisherField:
        self.fields[id] = PublisherField(id)
        return self.fields[id]

    def get_field(self, id: str) -> PublisherField:
        return self.fields[id]

    def delete_field(self, id: str) -> None:
        del self.fields[id]
