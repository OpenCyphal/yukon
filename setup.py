#!/usr/bin/env python3
# Copyright (C) 2021 UAVCAN Consortium
# This software is distributed under the terms of the MIT License.
# Author: Pavel Kirienko <pavel@uavcan.org>
# type: ignore

import logging
import setuptools
import distutils.command.build_py
from pathlib import Path

PACKAGE_NAME = "kucherx"
DSDL_SOURCE_ROOT = Path(__file__).resolve().parent / PACKAGE_NAME / "dsdl_src"

setuptools.setup()
