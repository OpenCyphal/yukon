import sys
import tkinter as tk


class MyDialog(tk.Toplevel):
    def __init__(self, parent: tk.Tk, text: str) -> None:
        tk.Toplevel.__init__(self, parent)
        tk.Label(self, text=text).grid(row=0, column=0, columnspan=2, padx=50, pady=10)

        b_yes = tk.Button(self, text="Yes", command=self.yes, width=8)
        b_yes.grid(row=1, column=0, padx=10, pady=10)
        b_no = tk.Button(self, text="No", command=self.no, width=8)
        b_no.grid(row=1, column=1, padx=10, pady=10)

        self.answer = False
        self.protocol("WM_DELETE_WINDOW", self.no)

    def yes(self) -> None:
        self.answer = True
        self.destroy()

    def no(self) -> None:
        self.answer = False
        self.destroy()


def launch_yes_no_dialog(text: str, title: str, timeout: int = 5000) -> bool:
    "Some text to display in the popup and a timeout in milliseconds"
    root = tk.Tk()
    d = MyDialog(root, text)
    d.title(title)
    root.attributes("-alpha", 0.0)
    root.wm_state("iconic")
    # Make the dialog box appear in the taskbar
    d.wm_attributes("-topmost", 1)
    # The dialog box should be focused

    # The title should be Yukon
    root.title("Yukon - Don't touch")
    if not sys.platform.lower().startswith("win"):
        root.withdraw()
    root.after(timeout, d.no)
    d.focus_force()
    root.lift()
    d.lift()
    root.wait_window(d)
    root.destroy()
    return d.answer
