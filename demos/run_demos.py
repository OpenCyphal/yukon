import os, subprocess

os.environ["UAVCAN__SUB__TEMPERATURE_SETPOINT__ID"] = "2345"
os.environ["UAVCAN__SUB__TEMPERATURE_MEASUREMENT__ID"] = "2346"
os.environ["UAVCAN__PUB__HEATER_VOLTAGE__ID"] = "2347"
os.environ["UAVCAN__SRV__LEAST_SQUARES__ID"] = "123"
os.environ["UAVCAN__DIAGNOSTIC__SEVERITY"] = "2"
os.environ["UAVCAN__NODE__ID"] = "42"
os.environ["UAVCAN__UDP__IFACE"] = "127.0.0.1"
from subprocess import Popen
from pathlib import Path

current_directory = Path(__file__).parent.absolute()
demo_app_path = current_directory / "demo_app.py"
os.chdir(current_directory)
how_many = 6
commands = []
for i in range(how_many):
    commands.append(f"python {demo_app_path.absolute()}")
procs = []
for i, command in enumerate(commands):
    os.environ["UAVCAN__NODE__ID"] = str(42 + i)
    os.environ["UAVCAN__UDP__IFACE"] = "127.0.0." + str(1 + i)
    procs.append(Popen(command, shell=True, env=os.environ))
for proc in procs:
    proc.wait()
