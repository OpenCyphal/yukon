class DetachTransportRequest:
    def __init__(self, interface_hash):
        self.interface_hash = interface_hash

    def __str__(self):
        return "DetachTransportRequest(%s)" % self.interface_hash

    def __repr__(self):
        return self.__str__()
