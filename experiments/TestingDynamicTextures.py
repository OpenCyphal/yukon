import dearpygui.dearpygui as dpg
import networkx as nx
import matplotlib.pyplot as plt
from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas

dpg.create_context()


def bti(byte):
    """Byte to int"""
    return byte / 255


image_size = 600

new_texture_data = []
G = nx.DiGraph()
G.add_node(125)
G.add_node(7519)
G.add_node(100)
G.add_node(80)
G.add_edge(100, 7519)
G.add_edge(7519, 80)
G.add_edge(125, 7519)

pos = nx.spring_layout(G)

px = 1 / plt.rcParams['figure.dpi']  # pixel in inches
figure = plt.figure(figsize=(image_size * px, image_size * px))
canvas = FigureCanvas(figure)
nx.draw(G, pos=pos, with_labels=True, node_shape="p", node_size=2600)
edge_labels = dict([((n1, n2), f'{n1}->{n2}')
                    for n1, n2 in G.edges])
nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels)
canvas.draw()
new_texture_data2 = canvas.tostring_rgb()
for i in range(0, image_size * image_size * 3, 3):
    new_texture_data.append(bti(new_texture_data2[i]))
    new_texture_data.append(bti(new_texture_data2[i + 1]))
    new_texture_data.append(bti(new_texture_data2[i + 2]))
    new_texture_data.append(1)

with dpg.texture_registry(show=False):
    dpg.add_dynamic_texture(width=image_size, height=image_size, default_value=new_texture_data, tag="texture_tag")

with dpg.window(label="Tutorial") as main_window:
    dpg.add_image("texture_tag")
dpg.set_primary_window(main_window, True)

dpg.create_viewport(title='Custom Title', width=800, height=800, )

dpg.setup_dearpygui()
dpg.show_viewport()
dpg.start_dearpygui()
dpg.destroy_context()
