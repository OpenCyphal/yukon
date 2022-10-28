import os
import platform
import traceback

from pycyphal.application import make_transport

from yukon.domain.attach_transport_request import AttachTransportRequest
from yukon.domain.attach_transport_response import AttachTransportResponse
from yukon.services.faulty_transport import FaultyTransport
from yukon.domain.god_state import GodState

my_os = platform.system()


async def do_attach_transport_work(state: GodState) -> None:
    if not state.queues.attach_transport.empty():
        try:
            atr: AttachTransportRequest = state.queues.attach_transport.get_nowait()
            if atr.requested_interface.is_udp:
                if state.cyphal.already_used_transport_interfaces.get(atr.requested_interface.udp_iface):
                    raise Exception("Interface already in use")
            else:
                if state.cyphal.already_used_transport_interfaces.get(atr.requested_interface.iface):
                    raise Exception("Interface already in use")
            new_transport = make_transport(atr.get_registry())
            try:
                if atr.requested_interface.is_udp and os.environ.get("YUKON_IS_UDP_FAULTY"):
                    new_transport = FaultyTransport(new_transport)
                    new_transport.faulty = True
                state.cyphal.pseudo_transport.attach_inferior(new_transport)
            except Exception:
                new_transport.close()
                state.cyphal.pseudo_transport.detach_inferior(new_transport)
                raise
            state.cyphal.inferior_transports_by_interface_hashes[str(hash(atr.requested_interface))] = new_transport
            attach_transport_response = AttachTransportResponse(True, atr.requested_interface.iface)
            state.cyphal.transports_list.append(atr.requested_interface)
            state.queues.attach_transport_response.put(attach_transport_response)
            if atr.requested_interface.is_udp:
                state.cyphal.already_used_transport_interfaces[atr.requested_interface.udp_iface] = True
            else:
                state.cyphal.already_used_transport_interfaces[atr.requested_interface.iface] = True
            print("Added a new interface")
        except PermissionError as pe:
            tb = traceback.format_exc()
            if "You need special privileges" in str(pe):
                if my_os == "Linux":
                    from tkinter import Tk, messagebox

                    ws = Tk()
                    ws.title("Python Guides")
                    ws.deiconify()
                    ws.lift()
                    ws.focus_force()
                    ws.geometry("1x1+0+0")
                    ws.config(bg="#5FB691")
                    messagebox.showinfo(
                        "You need to adjust permissions for UDP packet sniffing",
                        "The command is shown in the transport configuration window",
                    )
                    ws.withdraw()
                    ws.destroy()
            attach_transport_response = AttachTransportResponse(False, tb, str(pe))
            state.queues.attach_transport_response.put(attach_transport_response)
        except Exception as e:
            tb = traceback.format_exc()
            attach_transport_response = AttachTransportResponse(False, tb, str(e))
            state.queues.attach_transport_response.put(attach_transport_response)
        # else:
        #     tb = "Attached transport"
        #     attach_transport_response = AttachTransportResponse(True, tb)
        #     state.queues.attach_transport_response.put(attach_transport_response)