* Make a venv and install the requirements
    ```bat
    python -m venv venv
    venv\Scripts\activate.bat
    pip install -r requirements.txt -r dev-requirements.txt
    ```
* Install yakut and use it to create the .compiled folder for compiled dsdl
    ```bash
    pip install yakut
    yakut compile -O.compiled https://github.com/OpenCyphal/public_regulated_data_types/archive/refs/heads/master.zip
    ```

* Run the application
    ```batch
    set PYTHONPATH=.;.compiled
    set IS_DEBUG=1
    python yukon/__main__.py
    ```

* Build the application for your current OS and obtain ElectronJS (to run in ElectronJS)
    ```
    python build_exe.py
    ```

* Build the DSDL namespace for demos
    ```
    yakut compile -O.compiled demos\sirius_cyber_corp
    ```