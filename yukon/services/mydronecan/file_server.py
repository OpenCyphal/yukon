#
# Copyright (C) 2014-2015  UAVCAN Development Team  <uavcan.org>
#
# This software is distributed under the terms of the MIT License.
#
# Author: Ben Dyer <ben_dyer@mac.com>
#         Pavel Kirienko <pavel.kirienko@zubax.com>
#         Silver Valdvee <silver.valdvee@zubax.com>

from __future__ import division, absolute_import, print_function, unicode_literals
import os
from collections import defaultdict
from logging import getLogger
import dronecan
from dronecan import uavcan
import errno


logger = getLogger(__name__)


# noinspection PyBroadException
class SimpleFileServer(object):
    def __init__(self, node):
        if node.is_anonymous:
            raise dronecan.UAVCANException("File server cannot be launched on an anonymous node")
        self.file_path = None
        self._handles = []
        self.is_enabled = False

        def add_handler(datatype, callback):
            self._handles.append(node.add_handler(datatype, callback))

        add_handler(uavcan.protocol.file.GetInfo, self._get_info)
        add_handler(uavcan.protocol.file.Read, self._read)

    def start(self):
        self.is_enabled = True

    def stop(self):
        self.is_enabled = False

    def _get_info(self, e):
        if not self.is_enabled:
            return
        logger.debug(
            "[#{0:03d}:uavcan.protocol.file.GetInfo] {1!r}".format(
                e.transfer.source_node_id, e.request.path.path.decode()
            )
        )
        try:
            with open(self._resolve_path(e.request.path), "rb") as f:
                data = f.read()
                resp = uavcan.protocol.file.GetInfo.Response()
                resp.error.value = resp.error.OK
                resp.size = len(data)
                resp.entry_type.flags = resp.entry_type.FLAG_FILE | resp.entry_type.FLAG_READABLE
        except Exception:
            # TODO: Convert OSError codes to the error codes defined in DSDL
            logger.exception("[#{0:03d}:uavcan.protocol.file.GetInfo] error", exc_info=True)
            resp = uavcan.protocol.file.GetInfo.Response()
            resp.error.value = resp.error.UNKNOWN_ERROR

        return resp

    def _read(self, e):
        if not self.is_enabled:
            return
        logger.debug(
            "[#{0:03d}:uavcan.protocol.file.Read] {1!r} @ offset {2:d}".format(
                e.transfer.source_node_id, e.request.path.path.decode(), e.request.offset
            )
        )
        try:
            with open(self.file_path, "rb") as f:
                f.seek(e.request.offset)
                resp = uavcan.protocol.file.Read.Response()
                read_size = dronecan.get_dronecan_data_type(dronecan.get_fields(resp)["data"]).max_size
                resp.data = bytearray(f.read(read_size))
                resp.error.value = resp.error.OK
        except Exception:
            logger.exception("[#{0:03d}:uavcan.protocol.file.Read] error")
            resp = uavcan.protocol.file.Read.Response()
            resp.error.value = resp.error.UNKNOWN_ERROR

        return resp
