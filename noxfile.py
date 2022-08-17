# Copyright (c) 2022 Zubax
# This software is distributed under the terms of the MIT License.
# Author: Silver Valdvee
# type: ignore

import shutil
from pathlib import Path
import nox

ROOT_DIR = Path(__file__).resolve().parent

PYTHONS = ["3.10"]
"""The newest supported Python shall be listed last."""

nox.options.error_on_external_run = True

compiled_dir = Path.cwd().resolve() / ".compiled"

src_dirs = [
    ROOT_DIR / "yukon",
    ROOT_DIR / "tests",
]


@nox.session(reuse_venv=True)
def black(session):
    session.run("pip", "install", "black == 22.*")
    # black yukon
    session.run("black", "--check", "yukon")


@nox.session(reuse_venv=True)
def mypy(session):
    session.run("pip", "install", "mypy==0.961")
    session.run("mypy", "yukon")


@nox.session(reuse_venv=True)
def pylint(session):
    session.run("pip", "install", "pylint==2.*")
    session.run("pylint", *map(str, src_dirs), env={"PYTHONPATH": str(compiled_dir)})
