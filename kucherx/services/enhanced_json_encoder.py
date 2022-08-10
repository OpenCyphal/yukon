import dataclasses
import json
import typing


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, o: typing.Any) -> typing.Any:
        if dataclasses.is_dataclass(o):
            return dataclasses.asdict(o)
        return super().default(o)
