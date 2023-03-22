from dataclasses import dataclass


@dataclass
class CreatePublisherRequest:
    datatype_name: str
    port_id: int
