* Make a venv and install the requirements on GNU/Linux
    ```bash
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt -r dev-requirements.txt
    ```
* Additional step when using systems where Tk is missing by default (like ArchLinux), installing Tk
    ```bash
    sudo pacman -S tk
    ```
* Install yakut and use it to create the .compiled folder for compiled dsdl
    ```bash
    pip install yakut
    yakut compile -O.compiled https://github.com/OpenCyphal/public_regulated_data_types/archive/refs/heads/master.zip
    ```
* Run the application
    ```bash
    IS_DEBUG=1 PYTHONPATH=.:.compiled python3 yukon/__main__.py
    ```
* Build the application for your current OS and obtain ElectronJS (to run in ElectronJS)
    ```
    python build_exe.py
    ```

* Build the DSDL namespace for demos
    ```
    yakut compile -O.compiled demos\sirius_cyber_corp
    ```
