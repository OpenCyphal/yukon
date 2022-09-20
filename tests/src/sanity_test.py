# Get the path to the root directory of the repository by taking the folder of current file and going two directories up
from pathlib import Path
import subprocess

root = Path(__file__).parent.parent.parent
print(root.absolute())

run_demos_path = root / "demos" / "run_demos.py"
print(run_demos_path.absolute())
# Run the python script at run_demos_path

subprocess.run(["python", str(run_demos_path.absolute())])
