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

# Contributing
1. Fork the repository
2. Make your changes
3. Make a pull request
4. Wait for a review
5. Make changes if needed
6. Merge

# Code style
- Use black for formatting
- Run `nox -s mypy` to check for type errors
- Run `nox -s pylint` to check for linting errors