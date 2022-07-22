import matplotlib.pyplot as plt
import networkx as nx
from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas

from domain.kucherx_state import KucherXState
from domain.queue_quit_object import QueueQuitObject


def bti(byte):
    """Byte to int"""
    return byte / 255


def _image_from_graph_thread(state: KucherXState) -> None:
    while state.gui_running:
        G = state.update_image_from_graph.get()
        if isinstance(G, QueueQuitObject):
            break
        else:
            print("This is not a queue quit object")
        image_size = 600
        px = 1 / plt.rcParams["figure.dpi"]  # pixel in inches
        plt.rcParams["backend"] = "TkAgg"
        figure = plt.figure(figsize=(image_size * px, image_size * px))
        canvas = FigureCanvas(figure)
        pos = nx.spring_layout(G)
        nx.draw(G, pos=pos, with_labels=True, node_shape="p", node_size=2600)
        # https://stackoverflow.com/questions/47094949/labeling-edges-in-networkx
        edge_labels = dict([((n1, n2), f"{n1}->{n2}") for n1, n2 in G.edges])
        nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels)
        canvas.draw()
        new_texture_data2 = canvas.tostring_rgb()
        plt.show()
        new_texture_data = []
        for i in range(0, image_size * image_size * 3, 3):
            new_texture_data.append(bti(new_texture_data2[i]))
            new_texture_data.append(bti(new_texture_data2[i + 1]))
            new_texture_data.append(bti(new_texture_data2[i + 2]))
            new_texture_data.append(1)
        state.dpg.set_value("monitor_graph_texture_tag", new_texture_data)
