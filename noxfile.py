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
    ROOT_DIR / "kucherx",
    ROOT_DIR / "tests",
]


@nox.session(python=False)
def clean(session):
    wildcards = [
        "dist",
        "build",
        "html*",
        ".coverage*",
        ".*cache",
        ".*compiled",
        ".*generated",
        "*.egg-info",
        "*.log",
        "*.tmp",
        ".nox",
    ]
    for w in wildcards:
        for f in Path.cwd().glob(w):
            session.log(f"Removing: {f}")
            shutil.rmtree(f, ignore_errors=True)


@nox.session()
def demo(session):
    """
    Test the demo app orchestration example.
    This is a separate session because it is dependent on Yakut.
    """
    session.install(".")

    session.env["STOP_AFTER"] = "10"
    session.run("python3.10", "kucherx/main.py", success_codes=[0])


@nox.session(reuse_venv=True)
def black(session):
    session.run("pip", "install", "black == 22.*")
    # black kucherx --exclude kucherx/libraries
    session.run("black", "--check", "kucherx", "--exclude", "kucherx/libraries")


@nox.session(reuse_venv=True)
def mypy(session):
    session.run("pip", "install", "mypy==0.961")
    session.run("mypy", "kucherx", "--exclude", "kucherx/libraries")


@nox.session(reuse_venv=True)
def pylint(session):
    session.run("pip", "install", "pylint==2.*")
    session.run("pylint", *map(str, src_dirs), env={"PYTHONPATH": str(compiled_dir)})
