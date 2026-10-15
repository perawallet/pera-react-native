"""Collects the app's [E2E-NAV] trace per test and flags navigation red flags.

The E2E build logs screen mount/unmount, focus/blur, app foreground/background
and same-screen double opens (apps/mobile/.../handlers/e2eNavTracer.ts). This
listener reads them from the device log after every test, records the flow, and
reports:
- double-open: the same screen pushed twice in one stack
- leak: a screen still mounted after a fixture reset, outside the tab shell
- bounce: focus leaving a screen and coming straight back within BOUNCE_MS
Flows are written to <outputdir>/nav-flows.json for tools/flow_diff.py.
"""

import json
import os

from robot.api import logger
from robot.libraries.BuiltIn import BuiltIn

TAG = "[E2E-NAV]"
BOUNCE_MS = 400


def parse(lines):
    events = []
    for line in lines:
        at = line.find(TAG)
        if at < 0:
            continue
        try:
            events.append(json.loads(line[at + len(TAG):].strip()))
        except ValueError:
            continue
    return events


def red_flags(events):
    flags = []
    focus = [e for e in events if e.get("event") == "focus"]
    for e in events:
        if e.get("event") == "double-open":
            flags.append(f"double-open: {e['screen']}")
        if e.get("event") == "snapshot":
            leaked = [s for s in e.get("screens", []) if not s.startswith("TabBar")]
            if leaked:
                flags.append(f"leak after {e.get('label')}: {', '.join(sorted(set(leaked)))}")
    for a, b, c in zip(focus, focus[1:], focus[2:]):
        if a["screen"] == c["screen"] != b["screen"] and c["t"] - a["t"] < BOUNCE_MS:
            flags.append(f"bounce: {a['screen']} -> {b['screen']} -> back in {c['t'] - a['t']}ms")
    return flags


def flow(events):
    """Focus sequence without immediate repeats: the path the user actually saw."""
    seq = []
    for e in events:
        if e.get("event") == "focus" and (not seq or seq[-1] != e["screen"]):
            seq.append(e["screen"])
    return seq


class NavTrace:
    ROBOT_LIBRARY_SCOPE = "GLOBAL"
    ROBOT_LISTENER_API_VERSION = 3

    def __init__(self):
        self.ROBOT_LIBRARY_LISTENER = self
        self.flows = {}
        self.outdir = None

    def _driver(self):
        try:
            appium = BuiltIn().get_library_instance("AppiumLibrary")
            return appium._current_application()
        except Exception:
            return None

    def _read(self):
        driver = self._driver()
        if driver is None:
            return []
        platform = str(driver.capabilities.get("platformName", "")).lower()
        log_type = "logcat" if platform == "android" else "syslog"
        try:
            return [entry.get("message", "") for entry in driver.get_log(log_type)]
        except Exception:
            return []

    def start_test(self, data, result):
        self.outdir = BuiltIn().get_variable_value("${OUTPUT DIR}")
        self._read()  # drop whatever was logged before this test

    def end_test(self, data, result):
        events = parse(self._read())
        test_id = next((t[3:] for t in result.tags if t.startswith("id:")), result.longname)
        self.flows[test_id] = {"flow": flow(events), "flags": red_flags(events), "status": result.status}
        if events:
            logger.info("Navigation flow: " + " > ".join(self.flows[test_id]["flow"]))
        for flag in self.flows[test_id]["flags"]:
            logger.warn(f"{result.name}: {flag}")
        # Rewritten after every test so a crashed run still leaves its flows behind.
        if self.outdir:
            with open(os.path.join(self.outdir, "nav-flows.json"), "w") as f:
                json.dump(self.flows, f, indent=1, sort_keys=True)
