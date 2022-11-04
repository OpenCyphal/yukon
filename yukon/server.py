import json
import logging
import os
import traceback
import typing

from inspect import signature
import sys
from flask import Flask, jsonify, request
from flask.blueprints import T_after_request
from werkzeug.serving import WSGIRequestHandler

from yukon.services.enhanced_json_encoder import EnhancedJSONEncoder
from yukon.domain.god_state import GodState
from yukon.services.api import Api

if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    root_path = sys._MEIPASS  # type: ignore # pylint: disable=protected-access
else:
    root_path = os.path.dirname(os.path.abspath(__file__))
gui_dir = os.path.join(root_path, "web")  # development path

if not os.path.exists(gui_dir):  # frozen executable path
    gui_dir = os.path.join(root_path, "yukon", "web")

server = Flask(__name__, static_folder=gui_dir, template_folder=gui_dir, static_url_path="")
server.config["SEND_FILE_MAX_AGE_DEFAULT"] = 1  # disable caching
server.json_encoder = EnhancedJSONEncoder
WSGIRequestHandler.protocol_version = "HTTP/1.1"
our_token = "ABC"
logger = logging.getLogger(__file__)
logger.setLevel("NOTSET")


@server.after_request
def add_header(response: T_after_request) -> T_after_request:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET,HEAD,OPTIONS,POST,PUT"
    response.headers["Access-Control-Allow-Headers"] = "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    return response


def make_landing_and_bridge(state: GodState, api: Api) -> None:
    @server.route("/api/<path:path>", methods=["GET", "POST"])
    def landing_and_bridge(path: str) -> typing.Any:
        _object: typing.Any = {"arguments": []}
        try:
            _object = request.get_json()
        except Exception as _:  # pylint: disable=broad-except
            pass
            # logger.warning("There was no json data attached")
        try:
            found_method = getattr(api, path)
        except Exception:  # pylint: disable=broad-except
            logger.error("There was an error while trying to find the method %s", path)
            return jsonify({"error": "Didn't find the method"})
        # Print the name of found method
        if len(_object["arguments"]) != len(signature(found_method).parameters):
            logger.error("There was an error, there weren't enough input parameters for the method %s", path)
        try:
            response = found_method(*(_object["arguments"]))
            if response is None:
                return '["the API method returns None"]'
            return response
        except Exception as e:  # pylint: disable=broad-except
            tb = traceback.format_exc()
            logger.exception("So something went wrong with calling the method %s", path)

            logger.error("Arguments used calling the API %s", json.dumps(_object["arguments"]))
            logger.critical(tb)
            return jsonify({"error": tb})
