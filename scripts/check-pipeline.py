import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import requests
from dateutil import parser


@dataclass
class _WorkflowStatus:
    created_at: datetime
    name: str
    status: str


_PIPELINE_URL = "https://circleci.com/api/v2/pipeline/{pipeline_id}/workflow"
_STATUSES: dict[str, _WorkflowStatus] = {}


def _process_data(items: list[dict[str, Any]]) -> None:
    for workflow in items:
        created_at = parser.parse(workflow["created_at"])
        name = workflow["name"]
        status = workflow["status"]
        if name not in _STATUSES:
            _STATUSES[name] = _WorkflowStatus(created_at, name, status)
        elif _STATUSES[name].created_at == created_at and _STATUSES[name].status != status:
            _STATUSES[name].status = status
        elif _STATUSES[name].created_at < created_at:
            status[name] = _WorkflowStatus(created_at, name, status)


def main() -> None:
    api_token = os.environ["API_TOKEN"]
    headers = {
        "Circle-Token": api_token,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    pipeline_id = sys.argv[1]
    print("Started checking workflows")
    while True:
        url = _PIPELINE_URL.format(pipeline_id=pipeline_id)
        res = requests.get(url, headers=headers)
        data = res.json()
        _process_data(data["items"])
        page_token = data["next_page_token"]
        while page_token is not None:
            res = requests.get(url, headers=headers, params={"page-token": page_token})
            data = res.json()
            _process_data(data["items"])
            page_token = data["next_page_token"]

        running_workflows = [
            workflow for workflow in _STATUSES.values() if workflow.status == "running"
        ]
        # check-and-publish should be ignored
        if len(running_workflows) == 1 and running_workflows[0].name == "check-and-publish":
            if any(
                workflow.status not in ("success", "running") for workflow in _STATUSES.values()
            ):
                print("There was at least one workflow failed")
                sys.exit(1)
            else:
                print("Pipeline was successful")
                sys.exit(0)
        elif len(running_workflows) > 1:
            print("There are running workflows")
        time.sleep(1)


if __name__ == "__main__":
    main()
