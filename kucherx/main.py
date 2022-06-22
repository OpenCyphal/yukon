import dearpygui.dearpygui as dpg
import os
import asyncio
import time


def run_gui_app():
    dpg.create_context()
    dpg.create_viewport(title='Custom Title', width=600, height=300)

    with dpg.window(label="Example Window"):
        dpg.show_style_editor()
        dpg.add_text("Hello, world")
        dpg.add_button(label="Save")
        dpg.add_input_text(label="string", default_value="Quick brown fox")
        dpg.add_slider_float(label="float", default_value=0.273, max_value=1)

    dpg.setup_dearpygui()
    dpg.show_viewport()
    dpg.start_dearpygui()
    dpg.destroy_context()


def auto_exit_task():
    if os.environ.get("STOP_AFTER"):
        stop_after_value = int(os.environ.get("STOP_AFTER"))
        if stop_after_value:
            time.sleep(stop_after_value)
            print("Program should exit!")
            dpg.stop_dearpygui()
    return 0


async def main():
    await asyncio.gather(
        asyncio.to_thread(run_gui_app),
        asyncio.to_thread(auto_exit_task)
    )


if __name__ == "__main__":
    asyncio.run(main())
