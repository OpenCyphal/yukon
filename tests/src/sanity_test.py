# Get the path to the root directory of the repository by taking the folder of current file and going two directories up
from pathlib import Path
import subprocess
from subprocess import Popen
import os
import sys

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
os.environ["IS_BROWSER_BASED"] = "1"
os.environ["IS_SANITY_TEST"] = "1"
# The first argument to the script is the path to the browser that will be used, it doesn't have to be provided however
if len(sys.argv) > 1:
    os.environ["BROWSER_PATH"] = sys.argv[1]
run_demos_path = root / "demos" / "run_demos.py"
print(run_demos_path.absolute())
# Run the python script at run_demos_path in the background
python_exe = ""
if os.name == "nt":
    python_exe = "venv\\Scripts\\python.exe"
else:
    python_exe = "./venv/bin/python"
p = Popen(f"{python_exe} {str(run_demos_path.absolute())}", shell=True, env=os.environ)

# Run the yukon __main__.py script and save its exit code
arguments = [python_exe, str(root / "yukon" / "__main__.py")]
# If this subprocess run takes more than 20 seconds to run, then kill it and exit with code 1

try:
    subprocess.run(arguments, env=os.environ, timeout=20, check=True)
except subprocess.TimeoutExpired:
    print("Yukon took too long to complete the sanity test, exiting with code 1")
    sys.exit(1)
except subprocess.CalledProcessError as e:
    print("Yukon failed the sanity test, exiting with code 1")
    sys.exit(1)
else:
    print("Yukon passed the sanity test, exiting with code 0")
    sys.exit(0)
