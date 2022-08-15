import json
import logging
import os
import webbrowser
from functools import wraps

from flask import Flask, render_template, jsonify, request
import app
from domain.god_state import GodState
from services.api import Api

gui_dir = os.path.join(os.path.dirname(__file__), "html")  # development path

if not os.path.exists(gui_dir):  # frozen executable path
    gui_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'html')

server = Flask(__name__, static_folder=gui_dir, template_folder=gui_dir, static_url_path="")
server.config['SEND_FILE_MAX_AGE_DEFAULT'] = 1  # disable caching

our_token = "ABC"
logger = logging.getLogger(__file__)
logger.setLevel("NOTSET")


def verify_token(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        data = json.loads(request.data)
        token = data.get('token')
        if token == our_token:
            return function(*args, **kwargs)
        else:
            raise Exception('Authentication error')

    return wrapper


@server.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store'
    return response

from inspect import signature
def make_landing(state: GodState, api: Api):
    @server.route('/', defaults={'path': ''}, methods=["GET", 'POST'])
    @server.route('/<path:path>', methods=['POST'])
    def landing(path):
        if path == "":
            logger.info("Was requested the root path")
            return render_template('add_transport/add_transport.html', token=our_token)
        elif path == "main":
            return render_template('monitor/monitor.html', token=our_token)
        print(f"Requested {path}")
        logger.info(f"There was a request on path {path}")
        _object = {"arguments": []}
        try:
            _object = request.get_json()
        except:
            print("There was no json data attached")
        try:
            found_method = getattr(api, path)
        except Exception as e:
            print(f"There was an error while trying to find the method {path}")
            raise e
        # Print the name of found method
        print(f"Found method {found_method.__name__}")
        if len(_object["arguments"]) != len(signature(found_method).parameters):
            print(f"There was an error, there weren't enough input parameters for the method {path}")
            # Add the missing number of input arguments as empty strings
            for i in range(len(signature(found_method).parameters) - len(_object["arguments"])):
                _object["arguments"].append("")
        try:
            return found_method(*(_object["arguments"]))
        except Exception as e:
            print(e)
            return jsonify({"error": str(e)})
