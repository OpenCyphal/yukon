# Copyright (c) 2022 Zubax
# This software is distributed under the terms of the MIT License.
# Author: Silver Valdvee
# type: ignore

import os
import sys
import shutil
from functools import partial
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


@nox.session(python=PYTHONS, reuse_venv=True)
def linting(session):
    session.install("-r", "requirements.txt")
    session.install("-r", "requirements-dev.txt")

    session.cd(ROOT_DIR / "tests")

    env = {
        "PYTHONASYNCIODEBUG": "1",
        "PYTHONPATH": str(compiled_dir),
    }
    pytest = partial(session.run, "coverage", "run", "-m", "pytest", *session.posargs, env=env, success_codes=[0])
    # Application-layer tests are run separately after the main test suite because they require DSDL for
    # "uavcan" to be transpiled first. That namespace is transpiled as a side-effect of running the main suite.
    pytest()

    session.run("mypy", *map(str, src_dirs))
    session.run("pylint", *map(str, src_dirs))


@nox.session()
def demo(session):
    """
    Test the demo app orchestration example.
    This is a separate session because it is dependent on Yakut.
    """
    session.install("-r", "requirements.txt")

    session.env["STOP_AFTER"] = "10"
    session.run("python3.10", "kucherx/main.py", success_codes=[0])


@nox.session(reuse_venv=True)
def black(session):
    session.install("black == 22.*")
    session.run("black", "--check", ".")


@nox.session(reuse_venv=True)
def mypy(session):
    session.install("mypy==0.961")
    session.run("mypy", "kucherx")


@nox.session(reuse_venv=True)
def pylint(session):
    session.install("mypy==0.961")
    session.run("pylint", *map(str, src_dirs), env={"PYTHONPATH": str(compiled_dir)})

@nox.session(reuse_venv=True)
def coverage(session):
    # Coverage analysis and report.
    fail_under = 0 if session.posargs else 80
    session.run("coverage", "combine")
    session.run("coverage", "report", f"--fail-under={fail_under}")
    if session.interactive:
        session.run("coverage", "html")
        report_file = Path.cwd().resolve() / "htmlcov" / "index.html"
        session.log(f"COVERAGE REPORT: file://{report_file}")
    # Publish coverage statistics. This also has to be run from the test session to access the coverage files.
    if sys.platform.startswith("linux") and is_latest_python(session) and session.env.get("COVERALLS_REPO_TOKEN"):
        session.install("coveralls")
        session.run("coveralls")
    else:
        session.log("Coveralls skipped")

@nox.session(reuse_venv=True)
def docs(session):
    try:
        session.run("dot", "-V", silent=True, external=True)
    except Exception:
        session.error("Please install graphviz. It may be available from your package manager as 'graphviz'.")
        raise

    session.install("-r", "docs/requirements.txt")
    out_dir = Path(session.create_tmp()).resolve()
    session.cd("docs")
    sphinx_args = ["-b", "html", "-W", "--keep-going", f"-j{os.cpu_count() or 1}", ".", str(out_dir)]
    session.run("sphinx-build", *sphinx_args)
    session.log(f"DOCUMENTATION BUILD OUTPUT: file://{out_dir}/index.html")

    session.cd(ROOT_DIR)
    session.install("doc8 ~= 0.11")
    session.run("doc8", "docs", *map(str, ROOT_DIR.glob("*.rst")))


def is_latest_python(session) -> bool:
    return PYTHONS[-1] in session.run("python", "-V", silent=True)
