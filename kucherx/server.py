import logging
import os
import typing

from inspect import signature
from flask import Flask, render_template, jsonify, request
from flask.blueprints import T_after_request

from kucherx.domain.god_state import GodState
from kucherx.services.api import Api

gui_dir = os.path.join(os.path.dirname(__file__), "html")  # development path

if not os.path.exists(gui_dir):  # frozen executable path
    gui_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "html")

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
    @server.route("/main", methods=["GET"])
    def monitor() -> None:
        return render_template("monitor/monitor.html", token=our_token)

    @server.route("/", defaults={"path": ""}, methods=["GET", "POST"])
    @server.route("/<path:path>", methods=["GET", "POST"])
    def landing_and_bridge(path: str) -> typing.Any:
        if path == "":
            return render_template("add_transport/add_transport.html", token=our_token)

        _object: typing.Any = {"arguments": []}
        try:
            _object = request.get_json()
        except Exception as _:  # pylint: disable=broad-except
            logger.error("There was no json data attached")
        try:
            found_method = getattr(api, path)
        except Exception:  # pylint: disable=broad-except
            # pylint: disable=logging-format-interpolation
            logger.error("There was an error while trying to find the method " + path)
            return jsonify({"error": "Didn't find the method"})
        # Print the name of found method
        if len(_object["arguments"]) != len(signature(found_method).parameters):
            logger.error(f"There was an error, there weren't enough input parameters for the method {path}")
            # Add the missing number of input arguments as empty strings
            number_of_missing_arguments = len(signature(found_method).parameters) - len(_object["arguments"])
            # for i in range(number_of_missing_arguments):  # pylint: disable=unused-variable
            #     _object["arguments"].append("")
        try:
            response = found_method(*(_object["arguments"]))
            if response is None:
                return '["Nice"]'
            return response
        except Exception as e:  # pylint: disable=broad-except
            logger.error(e)
            return jsonify({"error": str(e)})
