import pytest
import subprocess

from tests.src.necessary.root_folder import get_root_folder


@pytest.fixture
def yukon():
    root_path = get_root_folder()
    yukon_path = root_path / "yukon" / "__main__.py"
    subprocess.run([yukon_path, "--port", "5001"])
