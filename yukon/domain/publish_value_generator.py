import typing


class StaticPublishValueGenerator:
    def __init__(self, value: typing.Any) -> None:
        self.value = value

    def generate(self) -> typing.Any:
        return self.value
