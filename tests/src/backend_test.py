# Get the path to the root directory of the repository by taking the folder of current file and going two directories up
from pathlib import Path
import subprocess
from subprocess import Popen
from threading import Thread
import os
import sys
import time
import logging

logger = logging.getLogger(__name__)

root = Path(__file__).parent.parent.parent

# Add .compiled and yukon to PYTHONPATH
sys.path.append(str((root / ".compiled").absolute()))
sys.path.append(str((root / "yukon").absolute()))
sys.path.append(str(root.absolute()))

# If the system is Windows then path separator is ;, otherwise it is :
path_separator = ";" if os.name == "nt" else ":"

os.environ["PYTHONPATH"] = (
    str(root / ".compiled") + path_separator + str(root / "yukon") + path_separator + str(root.absolute())
)
os.environ["IS_HEADLESS"] = "1"
os.environ["YUKON_IS_UDP_FAULTY"] = "1"
os.environ["YUKON_UDP_IFACE"] = "127.0.0.127"
os.environ["YUKON_NODE_ID"] = "1"
os.environ["YUKON_UDP_MTU"] = "1200"
os.environ["PYCYPHAL_LOGLEVEL"] = "CRITICAL"
# The first argument to the script is the path to the browser that will be used, it doesn't have to be provided however
run_demos_path = root / "demos" / "run_demos.py"
print(run_demos_path.absolute())
# Run the python script at run_demos_path in the background
python_exe = ""
if os.name == "nt":
    python_exe = "venv\\Scripts\\python.exe"
else:
    python_exe = "./venv/bin/python"


def run_yukon():
    needed_timeout = 20
    if os.environ.get("IS_DEBUG"):
        needed_timeout = None
    subprocess.run(arguments, env=os.environ, timeout=needed_timeout, check=True)


def get_avatars():
    # Make a request to the server to get the avatars, the url is http://localhost:5000/api/get_avatars
    import requests
    import json

    response = requests.post("http://localhost:5000/api/get_avatars")

    if response.status_code != 200:
        return False
    try:
        response_avatars = json.loads(response.text)
    except json.decoder.JSONDecodeError:
        return False
    avatars_array = response_avatars.get("avatars")
    if not avatars_array:
        return False
    required_registers_set = set(
        [
            "",
            "uavcan.udp.iface",
            "thermostat.error",
            "uavcan.node.description",
            "uavcan.serial.iface",
            "uavcan.can.mtu",
            "uavcan.can.iface",
            "uavcan.loopback",
            "uavcan.serial.baudrate",
            "uavcan.serial.duplicate_service_transfers",
            "uavcan.diagnostic.severity",
            "uavcan.udp.duplicate_service_transfers",
            "uavcan.srv.least_squares.type",
            "uavcan.sub.temperature_measurement.id",
            "uavcan.sub.temperature_setpoint.type",
            "uavcan.diagnostic.timestamp",
            "uavcan.node.unique_id",
            "thermostat.setpoint",
            "uavcan.srv.least_squares.id",
            "thermostat.pid.gains",
            "uavcan.udp.mtu",
            "uavcan.pub.heater_voltage.type",
            "uavcan.can.bitrate",
            "uavcan.sub.temperature_measurement.type",
            "uavcan.node.id",
            "uavcan.sub.temperature_setpoint.id",
            "uavcan.pub.heater_voltage.id",
        ]
    )
    if len(avatars_array) > 0:
        for avatar in avatars_array:
            copy_of_required_registers = required_registers_set.copy()
            for register in avatar["registers"]:
                if register in copy_of_required_registers:
                    copy_of_required_registers.remove(register)
            if len(copy_of_required_registers) > 0:
                return False
        return True
    return False


with Popen(f"{python_exe} {str(run_demos_path.absolute())}", shell=True, env=os.environ) as p:
    # Run the yukon __main__.py script and save its exit code
    arguments = [python_exe, str(root / "yukon" / "__main__.py")]
    try:
        yukon_running_thread = Thread(target=run_yukon, args=[], daemon=True)
        yukon_running_thread.start()
        success = False
        while yukon_running_thread.is_alive():
            time.sleep(5)
            if get_avatars():
                success = True
                break
        print("Subprocess run has finished")
        if not success:
            print("Failed to get avatars")
            sys.exit(1)
        else:
            print("Successfully got avatars")
            sys.exit(0)
    except subprocess.TimeoutExpired:
        print("Yukon took too long to complete the sanity test, exiting with code 1")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print("Yukon failed the sanity test, exiting with code 1")
        sys.exit(1)
    else:
        print("Yukon passed the sanity test, exiting with code 0")
        sys.exit(0)
