import json
import logging
import os
import typing

from inspect import signature
import sys
from flask import Flask, jsonify, request
from flask.blueprints import T_after_request

from yukon.domain.god_state import GodState
from yukon.services.api import Api

if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    root_path = sys._MEIPASS  # type: ignore # pylint: disable=protected-access
else:
    print("running in a normal Python process")
    root_path = os.path.dirname(os.path.abspath(__file__))
gui_dir = os.path.join(root_path, "web")  # development path

if not os.path.exists(gui_dir):  # frozen executable path
    gui_dir = os.path.join(root_path, "web")

server = Flask(__name__, static_folder=gui_dir, template_folder=gui_dir, static_url_path="")
server.config["SEND_FILE_MAX_AGE_DEFAULT"] = 1  # disable caching

our_token = "ABC"
logger = logging.getLogger(__file__)
logger.setLevel("NOTSET")


@server.after_request
def add_header(response: T_after_request) -> T_after_request:
    response.headers["Cache-Control"] = "no-store"
    return response


def make_landing_and_bridge(state: GodState, api: Api) -> None:
    @server.route("/api/<path:path>", methods=["GET", "POST"])
    def landing_and_bridge(path: str) -> typing.Any:
        _object: typing.Any = {"arguments": []}
        try:
            _object = request.get_json()
        except Exception as _:  # pylint: disable=broad-except
            logger.error("There was no json data attached")
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
                return '["Nice"]'
            return response
        except Exception as e:  # pylint: disable=broad-except
            logger.exception("So something went wrong with calling the method %s", path)

            logger.error("About the error %s", json.dumps(_object["arguments"]))
            return jsonify({"error": str(e)})
