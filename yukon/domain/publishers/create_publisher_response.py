from dataclasses import dataclass
from yukon.domain.simple_publisher import SimplePublisher


@dataclass
class CreatePublisherResponse:
    publisher: "SimplePublisher"
