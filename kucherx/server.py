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


def make_landing(state: GodState, api: Api) -> None:
    @server.route("/", defaults={"path": ""}, methods=["GET", "POST"])
    @server.route("/<path:path>", methods=["POST"])
    def landing(path: str) -> typing.Any:
        if path == "":
            logger.info("Was requested the root path")
            return render_template("add_transport/add_transport.html", token=our_token)
        if path == "main":
            return render_template("monitor/monitor.html", token=our_token)
        print(f"Requested {path}")
        logger.info(f"There was a request on path {path}")  # pylint: disable=logging-format-interpolation
        _object: typing.Any = {"arguments": []}
        try:
            _object = request.get_json()
        except Exception as _:  # pylint: disable=broad-except
            print("There was no json data attached")
        try:
            found_method = getattr(api, path)
        except Exception as e:  # pylint: disable=broad-except
            print(f"There was an error while trying to find the method {path}")
            raise e
        # Print the name of found method
        print(f"Found method {found_method.__name__}")
        if len(_object["arguments"]) != len(signature(found_method).parameters):
            print(f"There was an error, there weren't enough input parameters for the method {path}")
            # Add the missing number of input arguments as empty strings
            number_of_missing_arguments = len(signature(found_method).parameters) - len(_object["arguments"])
            for i in range(number_of_missing_arguments):  # pylint: disable=unused-variable
                _object["arguments"].append("")
        try:
            return found_method(*(_object["arguments"]))
        except Exception as e:  # pylint: disable=broad-except
            print(e)
            return jsonify({"error": str(e)})
