import networkx as nx
from matplotlib import pyplot as plt
from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas

def pixel_conversion(_input: int) -> float:
    """Byte to int"""
    return _input / 255


def render_graph(dpg, state):
    if not state.queues.image_from_graph.empty():
        state.queues.messages.put("Monitor image is being displayed")
        G = state.queues.image_from_graph.get_nowait()
        image_size_x = state.gui.requested_monitor_image_size[0]
        image_size_y = state.gui.requested_monitor_image_size[1]
        px = 1 / plt.rcParams["figure.dpi"]  # pixel in inches
        plt.rcParams["backend"] = "TkAgg"
        figure = plt.figure(figsize=(image_size_x * px, image_size_y * px))
        canvas = FigureCanvas(figure)
        pos = nx.spring_layout(G)
        nx.draw(G, pos=pos, with_labels=True, node_shape="p", node_size=2600)
        # https://stackoverflow.com/questions/47094949/labeling-edges-in-networkx
        edge_labels = dict([((n1, n2), f"{n1}->{n2}") for n1, n2 in G.edges])
        nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels)
        canvas.draw()
        new_texture_data2 = canvas.tostring_rgb()
        # plt.show()
        new_texture_data = []
        for i in range(0, image_size_x * image_size_y * 3, 3):
            new_texture_data.append(pixel_conversion(new_texture_data2[i]))
            new_texture_data.append(pixel_conversion(new_texture_data2[i + 1]))
            new_texture_data.append(pixel_conversion(new_texture_data2[i + 2]))
            new_texture_data.append(1)
        state.gui.dpg.set_value("monitor_graph_texture_tag", new_texture_data)
