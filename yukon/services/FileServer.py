import errno
import os
import pathlib
import shutil
import typing

import numpy as np
import pycyphal
from pycyphal.application.file import List, GetInfo, Modify, Read, Write, Error, _logger, Unstructured


class FileServer:
    """
    Exposes local filesystems via the standard RPC-services defined in ``uavcan.file``.
    The lifetime of this instance matches the lifetime of its node.
    """

    def __init__(
        self, node: pycyphal.application.Node, roots: typing.Iterable[typing.Union[str, pathlib.Path]]
    ) -> None:
        """
        :param node:
            The node instance to initialize the file server on.
            It shall not be anonymous, otherwise it's a
            :class:`pycyphal.transport.OperationNotDefinedForAnonymousNodeError`.

        :param roots:
            All file operations will be performed in the specified directories.
            The first directory to match takes precedence.
            New files are created in the first directory.
        """
        self._roots = [pathlib.Path(x).resolve() for x in roots]

        # noinspection PyUnresolvedReferences
        self._data_transfer_capacity = int(pycyphal.dsdl.get_model(Unstructured)["value"].data_type.capacity)

        self.service_list = node.get_server(List)
        self.service_info = node.get_server(GetInfo)
        self.service_modify = node.get_server(Modify)
        self.service_read = node.get_server(Read)
        self.service_write = node.get_server(Write)

        node.add_lifetime_hooks(self.start, self.close)

    def start(self) -> None:
        _logger.info("%r: Starting", self)
        self.service_list.serve_in_background(self._serve_list)
        self.service_info.serve_in_background(self._serve_getinfo)
        self.service_modify.serve_in_background(self._serve_modify)
        self.service_read.serve_in_background(self._serve_read)
        self.service_write.serve_in_background(self._serve_write)

    def close(self) -> None:
        self.service_list.close()
        self.service_info.close()
        self.service_modify.close()
        self.service_read.close()
        self.service_write.close()

    @property
    def roots(self) -> typing.List[pathlib.Path]:
        """
        File operations will be performed within these root directories.
        The first directory to match takes precedence.
        New files are created in the first directory in the list.
        The list can be modified.
        """
        return self._roots

    def locate(self, p: typing.Union[pathlib.Path, str, pathlib.Path]) -> typing.Tuple[pathlib.Path, pathlib.Path]:
        """
        Iterate through :attr:`roots` until a root r is found such that ``r/p`` exists and return ``(r, p)``.
        Otherwise, return nonexistent ``(roots[0], p)``.
        The leading slash makes no difference because we only search through the specified roots.

        :raises: :class:`FileNotFoundError` if :attr:`roots` is empty.
        """
        if isinstance(p, pathlib.Path):
            p = p.path.tobytes().decode(errors="ignore").replace(chr(pathlib.Path.SEPARATOR), os.sep)
        assert not isinstance(p, pathlib.Path)
        p = pathlib.Path(str(pathlib.Path(p)).strip(os.sep))  # Make relative, canonicalize the trailing separator
        # See if there are existing entries under this name:
        for r in self.roots:
            if (r / p).exists():
                return r, p
        # If not, assume that we are going to create one:
        if len(self.roots) > 0:
            return self.roots[0], p
        raise FileNotFoundError(str(p))

    def glob(self, pat: str) -> typing.Iterable[typing.Tuple[pathlib.Path, pathlib.Path]]:
        """
        Search for entries matching the pattern across :attr:`roots`, in order.
        Return tuple of (root, match), where match is relative to its root.
        Ordering not enforced.
        """
        pat = pat.strip(os.sep)
        for d in self.roots:
            for e in d.glob(pat):
                yield d, e.absolute().relative_to(d.absolute())

    @staticmethod
    def convert_error(ex: Exception) -> Error:
        for ty, err in {
            FileNotFoundError: Error.NOT_FOUND,
            IsADirectoryError: Error.IS_DIRECTORY,
            NotADirectoryError: Error.NOT_SUPPORTED,
            PermissionError: Error.ACCESS_DENIED,
            FileExistsError: Error.INVALID_VALUE,
        }.items():
            if isinstance(ex, ty):
                return Error(err)
        if isinstance(ex, OSError):
            return Error(
                {
                    errno.EACCES: Error.ACCESS_DENIED,
                    errno.E2BIG: Error.FILE_TOO_LARGE,
                    errno.EINVAL: Error.INVALID_VALUE,
                    errno.EIO: Error.IO_ERROR,
                    errno.EISDIR: Error.IS_DIRECTORY,
                    errno.ENOENT: Error.NOT_FOUND,
                    errno.ENOTSUP: Error.NOT_SUPPORTED,
                    errno.ENOSPC: Error.OUT_OF_SPACE,
                }.get(ex.errno, Error.UNKNOWN_ERROR)
            )
        return Error(Error.UNKNOWN_ERROR)

    async def _serve_list(
        self, request: List.Request, meta: pycyphal.presentation.ServiceRequestMetadata
    ) -> List.Response:
        _logger.info("%r: Request from %r: %r", self, meta.client_node_id, request)
        try:
            d = pathlib.Path(*self.locate(request.directory_path))
            for i, e in enumerate(sorted(d.iterdir())):
                if i == request.entry_index:
                    rel = e.absolute().relative_to(d.absolute())
                    return List.Response(pathlib.Path(str(rel)))
        except FileNotFoundError:
            pass
        except Exception as ex:
            _logger.exception("%r: Directory list error: %s", self, ex)
        return List.Response()

    async def _serve_getinfo(
        self, request: GetInfo.Request, meta: pycyphal.presentation.ServiceRequestMetadata
    ) -> GetInfo.Response:
        _logger.info("%r: Request from %r: %r", self, meta.client_node_id, request)
        try:
            p = pathlib.Path(*self.locate(request.path))
            return GetInfo.Response(
                size=p.resolve().stat().st_size,
                unix_timestamp_of_last_modification=int(p.resolve().stat().st_mtime),
                is_file_not_directory=p.is_file() or not p.is_dir(),  # Handle special files like /dev/null correctly
                is_link=os.path.islink(p),
                is_readable=os.access(p, os.R_OK),
                is_writeable=os.access(p, os.W_OK),
            )
        except Exception as ex:
            _logger.info("%r: Error: %r", self, ex, exc_info=True)
            return GetInfo.Response(self.convert_error(ex))

    async def _serve_modify(
        self, request: Modify.Request, meta: pycyphal.presentation.ServiceRequestMetadata
    ) -> Modify.Response:
        _logger.info("%r: Request from %r: %r", self, meta.client_node_id, request)

        try:
            if len(request.destination.path) == 0:  # No destination: remove
                p = pathlib.Path(*self.locate(request.source))
                if p.is_dir():
                    shutil.rmtree(p)
                else:
                    p.unlink()
                return Modify.Response()

            if len(request.source.path) == 0:  # No source: touch
                dst = pathlib.Path(*self.locate(request.destination)).resolve()
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.touch(exist_ok=True)
                return Modify.Response()

            # Resolve paths and ensure the target directory exists.
            src = pathlib.Path(*self.locate(request.source)).resolve()
            dst = pathlib.Path(*self.locate(request.destination)).resolve()
            dst.parent.mkdir(parents=True, exist_ok=True)

            # At this point if src does not exist it is definitely an error.
            if not src.exists():
                return Modify.Response(Error(Error.NOT_FOUND))

            # Can't proceed if destination exists but overwrite is not enabled.
            if dst.exists():
                if not request.overwrite_destination:
                    return Modify.Response(Error(Error.INVALID_VALUE))
                if dst.is_dir():
                    shutil.rmtree(dst, ignore_errors=True)
                else:
                    dst.unlink()

            # Do move/copy depending on the flag.
            if request.preserve_source:
                if src.is_dir():
                    shutil.copytree(src, dst)
                else:
                    shutil.copy(src, dst)
            else:
                shutil.move(str(src), str(dst))
            return Modify.Response()
        except Exception as ex:
            _logger.info("%r: Error: %r", self, ex, exc_info=True)
            return Modify.Response(self.convert_error(ex))

    async def _serve_read(
        self, request: Read.Request, meta: pycyphal.presentation.ServiceRequestMetadata
    ) -> Read.Response:
        _logger.info("%r: Request from %r: %r", self, meta.client_node_id, request)
        try:
            with open(pathlib.Path(*self.locate(request.path.path.tobytes().decode())), "rb") as f:
                if request.offset != 0:  # Do not seek unless necessary to support non-seekable files.
                    f.seek(request.offset)
                data = f.read(self._data_transfer_capacity)
            return Read.Response(data=Unstructured(np.frombuffer(data, np.uint8)))
        except Exception as ex:
            _logger.info("%r: Error: %r", self, ex, exc_info=True)
            return Read.Response(self.convert_error(ex))

    async def _serve_write(
        self, request: Write.Request, meta: pycyphal.presentation.ServiceRequestMetadata
    ) -> Write.Response:
        _logger.info("%r: Request from %r: %r", self, meta.client_node_id, request)
        try:
            data = request.data.value.tobytes()
            with open(pathlib.Path(*self.locate(request.path)), "rb+") as f:
                f.seek(request.offset)
                f.write(data)
                if not data:
                    f.truncate()
            return Write.Response()
        except Exception as ex:
            _logger.info("%r: Error: %r", self, ex, exc_info=True)
            return Write.Response(self.convert_error(ex))

    def __repr__(self) -> str:
        return pycyphal.util.repr_attributes(self, list(map(str, self.roots)))