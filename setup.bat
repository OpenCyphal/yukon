del /Q venv
del /Q .compiled
python -m venv venv
git submodule update --init --recursive
call venv\Scripts\activate.bat
pip install -r requirements.txt
pip install -r requirements-dev.txt
pip install -r requirements-win.txt
pip install yakut
mkdir .compiled
yakut compile -O.compiled https://github.com/OpenCyphal/public_regulated_data_types/archive/refs/heads/master.zip