class StaticPublishValueGenerator:
    def __init__(self, value) -> None:
        self.value = value

    def generate(self):
        return self.value
