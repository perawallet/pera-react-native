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

import base64
import json
import os
import time
from pathlib import Path

from robot.api import logger
from robot.libraries.BuiltIn import BuiltIn

TAG = "[E2E-NAV]"
BOUNCE_MS = 400
STRESS_TIERS = Path(__file__).resolve().parent.parent.parent / "stress-tiers.json"
# Screens outside the tab shell that each fixture opens on purpose; anything else mounted
# right after it is a leak.
FIXTURE_LANDING = {
    "fixture:contacts-empty": {"Contacts", "Contacts/ContactsList"},
    "fixture:contacts-one": {"Contacts", "Contacts/ContactsList"},
    # One contacts-<n> fixture per stress tier; stress-tiers.json is the list.
    **{
        f"fixture:contacts-{tier['contacts']}": {"Contacts", "Contacts/ContactsList"}
        for tier in json.loads(STRESS_TIERS.read_text())["tiers"].values()
    },
}


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
            landing = FIXTURE_LANDING.get(e.get("label"), set())
            leaked = [s for s in e.get("screens", []) if not s.startswith("TabBar") and s not in landing]
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
        self.pending = []
        self.tracer_seen = None
        self.last_seq = 0

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
        if platform == "android":
            try:
                return [entry.get("message", "") for entry in driver.get_log("logcat")]
            except Exception:
                return []
        return self._read_ios_file(driver)

    def _read_ios_file(self, driver):
        """iOS release builds keep console.log out of the system log, so the app mirrors the
        trace to Documents/e2e-nav.log; return only lines newer than the last one seen."""
        bundle = driver.capabilities.get("bundleId") or driver.capabilities.get("appium:bundleId")
        try:
            raw = base64.b64decode(driver.pull_file(f"@{bundle}:data/Documents/e2e-nav.log")).decode()
        except Exception:
            return []
        fresh = []
        for line in raw.splitlines():
            events = parse([line])
            seq = events[0].get("seq", 0) if events else 0
            if seq > self.last_seq:
                fresh.append(line)
                self.last_seq = seq
        if not fresh and raw and parse(raw.splitlines()[-1:]) and parse(raw.splitlines()[-1:])[0].get("seq", 0) < self.last_seq:
            # The app restarted and its counter began again: resynchronise on the new run.
            self.last_seq = 0
            return self._read_ios_file(driver)
        return fresh

    def drain_nav_log(self):
        """Keeps everything logged so far for the test's flow, so a later wait sees only new lines."""
        self.pending.extend(self._read())

    def wait_for_nav_snapshot(self, label, timeout=5.0):
        """Waits until the app logs the snapshot that follows a fixture reset.

        Returns False when no such line arrives in time (for example a device log that
        cannot be read), so the caller can fall back to a fixed wait.
        """
        if self.tracer_seen is False:
            return False  # a build without the tracer: don't pay the timeout on every fixture
        deadline = time.time() + float(timeout)
        while time.time() < deadline:
            lines = self._read()
            self.pending.extend(lines)
            for event in parse(lines):
                if event.get("event") == "snapshot" and event.get("label") == label:
                    self.tracer_seen = True
                    return True
            time.sleep(0.1)
        if self.tracer_seen is None:
            self.tracer_seen = False
        return False

    def start_test(self, data, result):
        self.outdir = BuiltIn().get_variable_value("${OUTPUT DIR}")
        self._read()  # drop whatever was logged before this test
        self.pending = []

    def end_test(self, data, result):
        events = parse(self.pending + self._read())
        self.pending = []
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
