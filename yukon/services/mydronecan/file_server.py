#
# Copyright (C) 2014-2015  UAVCAN Development Team  <uavcan.org>
#
# This software is distributed under the terms of the MIT License.
#
# Author: Ben Dyer <ben_dyer@mac.com>
#         Pavel Kirienko <pavel.kirienko@zubax.com>
#         Silver Valdvee <silver.valdvee@zubax.com>

from __future__ import division, absolute_import, print_function, unicode_literals
import io
import os
from collections import defaultdict
import logging
import typing
import dronecan
from dronecan import uavcan
import errno


logger = logging.getLogger(__name__)

# noinspection PyBroadException
class SimpleFileServer(object):
    def __init__(self, node: dronecan.node.Node, _file_path: str) -> None:
        if node.is_anonymous:
            raise dronecan.UAVCANException("File server cannot be launched on an anonymous node")
        self.file_path = _file_path
        self._handles: typing.Any = []
        self.is_enabled = False
        self.file_length = 0

        def add_handler(datatype: typing.Any, callback: typing.Any) -> None:
            self._handles.append(node.add_handler(datatype, callback))

        self.open_file_handle: typing.Optional[io.BufferedReader] = None
        add_handler(uavcan.protocol.file.GetInfo, self._get_info)
        add_handler(uavcan.protocol.file.Read, self._read)

    def start(self) -> None:
        logger.debug("Starting file server")
        self.is_enabled = True

    def stop(self) -> None:
        logger.debug("Stopping file server")
        self.is_enabled = False

    def _get_info(self, e: uavcan.protocol.file.GetInfo) -> uavcan.protocol.file.GetInfo.Response:
        if not self.is_enabled:
            return
        logger.debug(
            "[#{0:03d}:uavcan.protocol.file.GetInfo] {1!r}".format(
                e.transfer.source_node_id, e.request.path.path.decode()
            )
        )
        try:
            with open(self.file_path, "rb") as f:
                data = f.read()
                resp = uavcan.protocol.file.GetInfo.Response()
                resp.error.value = resp.error.OK
                self.file_length = len(data)
                resp.size = len(data)
                resp.entry_type.flags = resp.entry_type.FLAG_FILE | resp.entry_type.FLAG_READABLE
        except Exception:
            # TODO: Convert OSError codes to the error codes defined in DSDL
            logger.exception("[#{0:03d}:uavcan.protocol.file.GetInfo] error", exc_info=True)
            resp = uavcan.protocol.file.GetInfo.Response()
            resp.error.value = resp.error.UNKNOWN_ERROR

        return resp

    def _read(self, e: uavcan.protocol.file.Read) -> uavcan.protocol.file.Read.Response:
        if not self.is_enabled:
            return
        logger.debug(
            "[#{0:03d}:uavcan.protocol.file.Read] {1!r} @ offset {2:d}".format(
                e.transfer.source_node_id, e.request.path.path.decode(), e.request.offset
            )
        )
        # Print a percentage of the file that has been read using e.request.offset and self.file_length
        if self.file_length == 0:
            if self.open_file_handle is None:
                self.open_file_handle = open(self.file_path, "rb")
            # Seek to the start and read the whole file to get the length
            self.open_file_handle.seek(0)
            self.file_length = len(self.open_file_handle.read())
        logger.info("File read percentage: {0:.2f}%".format((e.request.offset / self.file_length) * 100))
        try:
            if self.open_file_handle is None:
                self.open_file_handle = open(self.file_path, "rb")

            self.open_file_handle.seek(e.request.offset)
            resp = uavcan.protocol.file.Read.Response()
            read_size = dronecan.get_dronecan_data_type(dronecan.get_fields(resp)["data"]).max_size
            resp.data = bytearray(self.open_file_handle.read(read_size))
            resp.error.value = resp.error.OK
        except Exception:
            logger.exception("[#{0:03d}:uavcan.protocol.file.Read] error")
            resp = uavcan.protocol.file.Read.Response()
            resp.error.value = resp.error.UNKNOWN_ERROR

        return resp
