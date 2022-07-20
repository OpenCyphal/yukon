rm -rf venv
rm -rf .compiled
git submodule update --init --recursive
python3 -m venv venv
. venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt
sudo apt install libjack-jackd2-dev libasound2-dev
pip install yakut
mkdir -p .compiled
yakut compile -O.compiled https://github.com/OpenCyphal/public_regulated_data_types/archive/refs/heads/master.zip
