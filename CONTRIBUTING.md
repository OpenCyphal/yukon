# Running the application in a development environment
* Clone the repository, there aren't any submodules
* Make a venv and install the requirements on GNU/Linux
    ```bash
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt -r dev-requirements.txt
    ```
* Additional step when using systems where Tk is missing by default (like ArchLinux)
    ```bash
    sudo pacman -S tk
    ```
* Make a venv and install the requirements on Windows
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
* Run the application on GNU/Linux
    ```bash
    IS_DEBUG=1 PYTHONPATH=.:.compiled python3 yukon/__main__.py
    ```
* Run the application on Windows
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

# Running the application in vscode
Use this as a template for your .env file, the .vscode also includes the launch configurations.

```
PYTHONPATH=C:\Users\silver\Documents\zubax\yukon\.compiled;C:\Users\silver\Documents\zubax\yukon
IS_BROWSER_BASED=1
IS_DEBUG=1
```

It's important to use absolute paths in the PYTHONPATH here.

On Windows use ; as the separator, on GNU/Linux use : as the separator.

# Contributing
1. Fork the repository
2. Make your changess
3. Make a pull request
4. Wait for a review
5. Make changes if needed
6. Merge the pull request

# Code style
- Use black for formatting
- Run `nox -s mypy` to check for type errors
- Run `nox -s pylint` to check for linting errors