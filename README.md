# KucherX

KucherX is a simple user-friendly GUI application designed for configuration, diagnostics,
and maintenance of [Cyphal](https://opencyphal.org/)-enabled Zubax hardware.
It is a tool for:

- Configuration and diagnostics of Cyphal-enabled hardware manufactured by Zubax.
- Visualization of data from Cyphal subjects and registers in real-time (online, on a live network).
- Exporting of the data captured from the live network for offline analysis (using Pandas, PlotJuggler, MATLAB, etc.)

KucherX does not aim to be a general-purpose Cyphal diagnostics tool.
If you need that, consider using [Yakut](https://github.com/OpenCyphal/yakut) instead.

KucherX is compatible with GNU/Linux and Windows.

We can relicense this project under the [MIT license](https://opensource.org/licenses/MIT). When we remove dynamic
linking to QT. At the moment we are using a webview from QT but there are so many more options to choose from. 
One of the most obvious choices is to just use a web browser and a server setup. It is also possible to use any of
the other web window providers from pywebview.

