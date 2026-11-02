"""Delete only the approved AsShown project during its one-day cleanup window."""
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError
from urllib.request import Request, urlopen

PROJECT = "prj_gnzeH8R1SFHCGT8hGFPoyN42kXhZ"
TEAM = "team_0dYibX2TtBJDRoAIBBHkgBWO"
DUE = datetime(2026, 11, 26, 5, 59, tzinfo=timezone.utc)  # Nov 25, 23:59 Chicago
URL = f"https://api.vercel.com/v9/projects/{PROJECT}?teamId={TEAM}"


def request(method, token):
    req = Request(URL, method=method, headers={"Authorization": f"Bearer {token}"})
    try:
        with urlopen(req, timeout=60) as response:
            body = response.read()
            return response.status, json.loads(body) if body else {}
    except HTTPError as error:
        return error.code, {}  # Never log provider bodies or credentials.


def run(now, event, token, check=False, call=request):
    if not check and (event != "schedule" or not DUE <= now < DUE + timedelta(days=1)):
        print("No deletion: outside the authorized scheduled window.")
        return
    if not token:
        raise RuntimeError("Missing VERCEL_CLEANUP_TOKEN repository secret; cleanup cannot run.")
    status, project = call("GET", token)
    if status == 404:
        print("Project is already absent.")
        return
    if status != 200:
        raise RuntimeError(f"Project lookup failed: HTTP {status}")
    if project.get("id") != PROJECT or project.get("name") != "asshown" or project.get("accountId") != TEAM:
        raise RuntimeError("Project identity mismatch; refusing deletion.")
    if check:
        print("Read-only check passed: token can access the exact AsShown project. Nothing deleted.")
        return
    status, _ = call("DELETE", token)
    if status not in (204, 404):
        raise RuntimeError(f"Project deletion failed: HTTP {status}")
    status, _ = call("GET", token)
    if status != 404:
        raise RuntimeError(f"Deletion not confirmed: lookup returned HTTP {status}")
    print("AsShown project deletion confirmed. GitHub and other projects were not targeted.")


if __name__ == "__main__":
    run(datetime.now(timezone.utc), os.getenv("GITHUB_EVENT_NAME", ""),
        os.getenv("VERCEL_CLEANUP_TOKEN", ""), check="--check" in sys.argv)
