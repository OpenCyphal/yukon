import copy
import threading
import time
from typing import Dict

from networkx import DiGraph

from kucherx.domain.avatar import Avatar
from kucherx.domain.god_state import GodState
from kucherx.domain.note_state import NodeState
from kucherx.domain.queue_quit_object import QueueQuitObject


def graph_from_avatars_thread(state: GodState) -> None:
    while state.gui.gui_running:
        time.sleep(0.05)
        if not state.queues.graph_from_avatar.empty():
            new_avatar = state.queues.graph_from_avatar.get()
            if isinstance(new_avatar, QueueQuitObject):
                print("Graph from avatars received a quit queue item!")
                break
            print("This is not a queue quit object")
            state.avatar.avatars_lock.acquire()
            # avatars_copy: Dict[int, Avatar] = copy.copy(state.avatars)
            state.avatar.avatars_lock.release()
            state.current_graph = DiGraph()
            state.current_graph.add_node(125)
            state.current_graph.add_node(7519)
            state.current_graph.add_node(100)
            state.current_graph.add_node(80)
            state.current_graph.add_edge(100, 7519)
            state.current_graph.add_edge(7519, 80)
            state.current_graph.add_edge(125, 7519)

            # for node_id_publishing, avatar_publishing in avatars_copy.items():
            #     node_state: NodeState = avatar_publishing.update(time.time())
            #     for subject_id in node_state.ports.pub:
            #         state.current_graph.add_edge(node_id_publishing, subject_id)
            #         for node_id_subscribing, avatar2_subscribing in avatars_copy.items():
            #             subscribing_node_state = avatar2_subscribing.update(time.time())
            #             if subject_id in subscribing_node_state.ports.sub:
            #                 state.current_graph.add_edge(subject_id, node_id_subscribing)
            state.queues.image_from_graph.put(state.current_graph)
