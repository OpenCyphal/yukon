class CommandSendRequest:
    def __init__(self, node_id: int, command_id: int, text_argument: str) -> None:
        self.node_id = node_id
        self.command_id = command_id
        self.text_argument = text_argument

    def __str__(self) -> str:
        command_string = "Command: " + str(self.command_id) + " destination to: " + str(self.node_id)
        if self.text_argument and self.text_argument != "":
            command_string += " argument: " + self.text_argument
        else:
            command_string += " with no arguments"
        return command_string
