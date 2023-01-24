# Running the application in a development environment

* Clone the repository, there aren't any submodules (you know how, just an example here)

      git clone https://github.com/OpenCyphal-Garage/yukon.git

* Only on GNU/Linux: Make a venv and install the requirements

      python -m venv venv
      source venv/bin/activate
      pip install -r requirements.txt -r dev-requirements.txt

* Only on Arch Linux: additional step when using systems where Tk is missing by default

      sudo pacman -S tk

* Only on Windows: Make a venv and install the requirements

      python -m venv venv
      venv\Scripts\activate.bat
      pip install -r requirements.txt -r dev-requirements.txt

* On every OS: Install yakut and use it to create the .compiled folder for compiled dsdl

      pip install yakut
      yakut compile -O.compiled https://github.com/OpenCyphal/public_regulated_data_types/archive/refs/heads/master.zip

* Only on GNU/Linux: Run the application

      IS_DEBUG=1 PYTHONPATH=.:.compiled python3 yukon/__main__.py

* Only on Windows: Run the application

      set PYTHONPATH=.;.compiled
      set IS_DEBUG=1
      python yukon/__main__.py

* On every OS: Build the application for your current OS and obtain ElectronJS (to run in ElectronJS)
  Without this step you will have to run Yukon in a browser.

      python build_exe.py

* On GNU/Linux: For ElectronJS Don't forget to run `chmod +x .electron/electron` to give the electron executable run permissions

* On every OS: Build the DSDL namespace for demos

This step will create demos that you can run and use to test Yukon if you have no Cyphal capable devices available
to connect to your computer.

    yakut compile -O.compiled demos/sirius_cyber_corp

* On every OS: Put the DSDL files that you need inside one of the lookup directories, this can be configured in settings of Yukon but it's /home/username/.cyphal by default

* On every OS: How to run the application from vscode, using the buttons

CREATE a .env file in the root of the project with the following content (; separator on Windows):

    PYTHONPATH=C:\Users\silver\Documents\zubax\yukon\.compiled;C:\Users\silver\Documents\zubax\yukon
    IS_BROWSER_BASED=1
    IS_DEBUG=1

It's IMPORTANT to use absolute paths in the PYTHONPATH here.

There is an IMPORTANT difference in the first line of the previous snippet: on Windows use ; as the separator, on
GNU/Linux use : as the separator.

It is also IMPORTANT that the PYTHONPATH contains the path to the .compiled folder and the path to the root directory of
the repository. It doesn't matter which order that paths are placed in.

* Prepare the sirius_cyber_corp namespace for using demos and tests
    ```batch
    yakut compile -O.compiled demos/sirius_cyber_corp
    ```

# Contributing

1. Fork the repository
2. Make your changess
3. Make a pull request
4. Wait for a review
5. Make changes if needed
6. Merge the pull request

When trying to make sense of the codebase, start from the yukon/services/api.py module. This handles all the requests that the frontend of Yukon makes 
to the backend and all the other services that the backend calls from there. The cyphal_workers subpackage in services contains a bunch of workers that
are used by the backend to delegate work to the thread that the Cyphal node is running on. This at least used to be the way it was handled, new code
is encouraged to just call self.state.cyphal_worker_asyncio_loop.call_soon_threadsafe(subscribe_task) (see reference in code) to schedule a task
on the same thread that the Cyphal node is running on.

# Code style

- Use black for formatting
- Run `nox -s mypy` to check for type errors
- Run `nox -s pylint` to check for linting errors