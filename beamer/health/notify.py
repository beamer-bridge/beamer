import json
import time
from pathlib import Path
from typing import Any, Callable, Optional, TypedDict

import requests
from typing_extensions import NotRequired
from xdg_base_dirs import xdg_state_home

NotificationConfig = dict[str, dict[str, str]]


class Message(TypedDict):
    text: str
    message_link: NotRequired[str]


class NotificationState:
    _notified_state: dict[str, set[str]]

    def __init__(self) -> None:
        def decode_set_in_state(pairs: list[tuple[Any, Any]]) -> dict[str, set[str]]:
            return {k: set(v) for k, v in pairs}

        try:
            with self._get_state_path().open("r") as f:
                self._notified_state = json.load(f, object_pairs_hook=decode_set_in_state)
        except FileNotFoundError:
            self._notified_state = {}

    def _get_state_path(self) -> Path:
        return xdg_state_home() / "beamer-bridge" / "health.json"

    def is_set(self, request_id: str, notified_on: str) -> bool:
        breadcrumb = self._notified_state.get(str(request_id))
        if breadcrumb is None:
            return False

        return notified_on in breadcrumb

    def update(self, request_id: str, notified_on: str) -> None:
        breadcrumb = self._notified_state.get(request_id)
        if breadcrumb is None:
            self._notified_state[request_id] = {notified_on}
        else:
            breadcrumb.add(notified_on)

    def persist(self) -> None:
        def encode_set_in_state(obj: set | list) -> list:
            if isinstance(obj, set):
                return list(obj)

            return obj

        path = self._get_state_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w") as f:
            json.dump(self._notified_state, f, default=encode_set_in_state)


class Notify:
    _notifications_sent = 0

    def __init__(self, system: str, config: NotificationConfig) -> None:
        self.system = system
        self.config = config

    def send(self, message: Message, callback: Optional[Callable] = None) -> None:
        throttling = float(self.config[self.system]["request-throttling-in-sec"])
        if self._notifications_sent > 0 and self._notifications_sent % 5 == 0 and throttling > 0:
            time.sleep(throttling)

        text = message["text"]

        message_link = message.get("message_link")
        if message_link is not None:
            text += f"\nView on [explorer]({message_link})"

        match self.system:
            case "rocketchat":
                status = self.send_to_rocketchat(text)
            case "telegram":
                status = self.send_to_telegram(text)
            case _:
                raise ValueError("Unknown notification system")

        if status:
            self._notifications_sent += 1
            if callback is not None:
                callback()

    def send_to_rocketchat(self, text: str) -> bool:
        headers = {"Content-Type": "application/json"}

        body = {
            "username": "beamer-health-check-bot",
            "channel": self.config["rocketchat"]["channel"],
            "icon": ":heart",
            "text": text,
        }

        r = requests.post(self.config["rocketchat"]["url"], data=json.dumps(body), headers=headers)

        return r.status_code == 200

    def send_to_telegram(self, text: str) -> bool:
        token = self.config["telegram"]["token"]
        chat_id = self.config["telegram"]["chat-id"]

        url = f"https://api.telegram.org/bot{token}/sendMessage?chat_id={chat_id}&text={text}"
        r = requests.get(url).json()

        return bool(r["ok"])
