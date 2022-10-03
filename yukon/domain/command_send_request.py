class CommandSendRequest:
    def __init__(self, node_id: int, command_id: int, text_argument: str) -> None:
        self.node_id = node_id
        self.command_id = command_id
        self.text_argument = text_argument

    def __str__(self) -> str:
        return (
            "A command to "
            + str(self.node_id)
            + ", the command is "
            + str(self.command_id)
            + " and the argument is "
            + self.text_argument
        )
