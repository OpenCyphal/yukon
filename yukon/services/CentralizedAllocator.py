import logging
import pathlib
import sqlite3
from typing import Optional, Union

import pycyphal
from pycyphal.application.plug_and_play import Allocator, _AllocationTable, _DB_DEFAULT_LOCATION, _DB_TIMEOUT, \
    _NUM_RESERVED_TOP_NODE_IDS, ID

from uavcan.pnp import NodeIDAllocationData_1, NodeIDAllocationData_2

_logger = logging.getLogger(__name__)


class CentralizedAllocator(Allocator):
    """
    The centralized plug-and-play node-ID allocator. See Specification for details.
    """

    def __init__(
            self,
            node: pycyphal.application.Node,
            database_file: Optional[Union[str, pathlib.Path]] = None,
    ):
        """
        :param node:
            The node instance to run the allocator on.
            The 128-bit globally unique-ID of the local node will be sourced from this instance.
            Refer to the Specification for details.

        :param database_file:
            If provided, shall specify the path to the database file containing an allocation table.
            If the file does not exist, it will be automatically created. If None (default), the allocation table
            will be created in memory (therefore the allocation data will be lost after the instance is disposed).
        """
        self._node = node
        local_node_id = self.node.id
        # if local_node_id is None:
        #     raise ValueError("The allocator cannot run on an anonymous node")
        # The database is initialized with ``check_same_thread=False`` to enable delegating its initialization
        # to a thread pool from an async context. This is important for this library because if one needs to
        # initialize a new instance from an async function, running the initialization directly may be unacceptable
        # due to its blocking behavior, so one is likely to rely on :meth:`asyncio.loop.run_in_executor`.
        # The executor will initialize the instance in a worker thread and then hand it over to the main thread,
        # which is perfectly safe, but it would trigger a false error from the SQLite engine complaining about
        # the possibility of concurrency-related bugs.
        self._alloc = _AllocationTable(
            sqlite3.connect(str(database_file or _DB_DEFAULT_LOCATION), timeout=_DB_TIMEOUT, check_same_thread=False)
        )
        self._alloc.register(local_node_id, self.node.info.unique_id.tobytes())
        self._sub1 = self.node.make_subscriber(NodeIDAllocationData_1)
        self._sub2 = self.node.make_subscriber(NodeIDAllocationData_2)
        self._pub1 = self.node.make_publisher(NodeIDAllocationData_1)
        self._pub2 = self.node.make_publisher(NodeIDAllocationData_2)
        self._pub1.send_timeout = self.DEFAULT_PUBLICATION_TIMEOUT
        self._pub2.send_timeout = self.DEFAULT_PUBLICATION_TIMEOUT
        self.running = False

        node.add_lifetime_hooks(self.start, self.close)

    def start(self) -> None:
        _logger.debug("Centralized allocator starting with the following allocation table:\n%s", self._alloc)
        self._sub1.receive_in_background(self._on_message)
        self._sub2.receive_in_background(self._on_message)
        self.running = True

    def close(self) -> None:
        for port in [self._sub1, self._sub2, self._pub1, self._pub2]:
            assert isinstance(port, pycyphal.presentation.Port)
            port.close()
        self._alloc.close()
        self.running = False

    @property
    def node(self) -> pycyphal.application.Node:
        return self._node

    def register_node(self, node_id: int, unique_id: Optional[bytes]) -> None:
        self._alloc.register(node_id, unique_id)

    async def _on_message(
            self, msg: Union[NodeIDAllocationData_1, NodeIDAllocationData_2], meta: pycyphal.transport.TransferFrom
    ) -> None:
        if meta.source_node_id is not None:
            _logger.error(  # pylint: disable=logging-fstring-interpolation
                f"Invalid network configuration: another node-ID allocator detected at node-ID {meta.source_node_id}. "
                f"There shall be exactly one allocator on the network. If modular redundancy is desired, "
                f"use a distributed allocator (currently, a centralized allocator is running). "
                f"The detected allocation response message is {msg} with metadata {meta}."
            )
            return

        _logger.debug("Received allocation request %s with metadata %s", msg, meta)
        max_node_id = self.node.presentation.transport.protocol_parameters.max_nodes - 1 - _NUM_RESERVED_TOP_NODE_IDS
        assert max_node_id > 0

        if isinstance(msg, NodeIDAllocationData_1):
            allocated = self._alloc.allocate(max_node_id, max_node_id, uid=msg.unique_id_hash)
            if allocated is not None:
                self._respond_v1(meta.priority, msg.unique_id_hash, allocated)
                return
        elif isinstance(msg, NodeIDAllocationData_2):
            uid = msg.unique_id.tobytes()
            allocated = self._alloc.allocate(msg.node_id.value, max_node_id, uid=uid)
            if allocated is not None:
                self._respond_v2(meta.priority, uid, allocated)
                return
        else:
            assert False, "Internal logic error"
        _logger.warning("Allocation table is full, ignoring request %s with %s. Please purge the table.", msg, meta)

    def _respond_v1(self, priority: pycyphal.transport.Priority, unique_id_hash: int, allocated_node_id: int) -> None:
        msg = NodeIDAllocationData_1(unique_id_hash=unique_id_hash, allocated_node_id=[ID(allocated_node_id)])
        _logger.info("Publishing allocation response v1: %s", msg)
        self._pub1.priority = priority
        self._pub1.publish_soon(msg)

    def _respond_v2(self, priority: pycyphal.transport.Priority, unique_id: bytes, allocated_node_id: int) -> None:
        msg = NodeIDAllocationData_2(
            node_id=ID(allocated_node_id),
            unique_id=unique_id,
        )
        _logger.info("Publishing allocation response v2: %s", msg)
        self._pub2.priority = priority
        self._pub2.publish_soon(msg)
