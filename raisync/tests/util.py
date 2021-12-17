import json
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer

import requests


class _HTTPRequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.server: HTTPProxy  # make mypy happy

        content_len = int(self.headers.get("Content-Length"))
        post_body = self.rfile.read(content_len)
        url = self.server.target_address
        try:
            response = requests.post(url, data=post_body)
        except requests.exceptions.ConnectionError:
            self.send_response_only(HTTPStatus.SERVICE_UNAVAILABLE)
            return

        data = json.loads(post_body)
        method = data["method"]
        delay = self.server.call_delays.get(method)
        if delay is not None:
            if callable(delay):
                delay = delay(data)
            time.sleep(delay)

        try:
            self.send_response(response.status_code)
            self.end_headers()
            self.wfile.write(response.content)
            self.wfile.flush()
        except ConnectionError:
            pass


class HTTPProxy(HTTPServer):
    def __init__(self, target_address):
        super().__init__(("", 0), _HTTPRequestHandler)
        self.target_address = target_address
        self.call_delays = {}

    def start(self) -> None:
        self._thread = threading.Thread(target=self.serve_forever)
        self._thread.start()

    def stop(self) -> None:
        self.shutdown()
        self._thread.join()

    def delay_rpc(self, call_delays):
        self.call_delays = call_delays
