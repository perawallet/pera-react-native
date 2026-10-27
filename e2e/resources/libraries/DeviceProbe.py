"""Readings taken from outside the app: adb on Android, idevicecrashreport on iOS.

Nothing here talks to the app. The pure parsing lives in stress_probe.py; this file only runs the
tools and hands their text over. Android readings need adb on PATH and the device attached; iOS
crash collection needs a real device (a simulator keeps its reports elsewhere).
"""

import subprocess
import tempfile
import time
from pathlib import Path

from robot.api import logger

from stress_probe import (
    crash_events,
    ios_crash_reports,
    parse_am_start_total_ms,
    parse_cpuinfo_pct,
    parse_gfxinfo,
    parse_meminfo_pss_kb,
)


def _run(command, timeout=120):
    try:
        done = subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)
    except FileNotFoundError as error:
        raise AssertionError(f"{command[0]} is not on PATH: {error}") from error
    return done.stdout + done.stderr


class DeviceProbe:
    ROBOT_LIBRARY_SCOPE = "GLOBAL"

    def __init__(self, udid="", package="", ios_bundle_id="", ios_process_name="Pera"):
        self.udid = udid
        self.package = package
        self.ios_bundle_id = ios_bundle_id
        self.ios_process_name = ios_process_name

    def _adb(self, *args, timeout=120):
        serial = ["-s", self.udid] if self.udid else []
        return _run(["adb", *serial, *args], timeout)

    def android_reset_frame_stats(self):
        self._adb("shell", "dumpsys", "gfxinfo", self.package, "reset")

    def android_frame_stats(self):
        return parse_gfxinfo(self._adb("shell", "dumpsys", "gfxinfo", self.package))

    def android_memory_pss_kb(self):
        return parse_meminfo_pss_kb(self._adb("shell", "dumpsys", "meminfo", self.package))

    def android_cold_start_ms(self, activity):
        """Force-stops the app and times a cold launch; the caller relaunches through Appium after."""
        self._adb("shell", "am", "force-stop", self.package)
        out = self._adb("shell", "am", "start", "-W", "-n", f"{self.package}/{activity}")
        return parse_am_start_total_ms(out)

    def android_cpu_pct(self):
        """Android's own recent window (about 30 s), not an instant reading."""
        return parse_cpuinfo_pct(self._adb("shell", "dumpsys", "cpuinfo"), self.package)

    def android_clear_crash_log(self):
        self._adb("logcat", "-b", "all", "-c")

    def android_crash_events(self):
        return crash_events(self._adb("logcat", "-b", "all", "-d", timeout=180), self.package)

    def ios_pull_crash_reports(self, outdir=None, since_epoch=0):
        """Names of crash, jetsam and cpu_resource reports written on the device since `since_epoch`."""
        if not self.udid:
            logger.warn("No IOS_UDID: crash reports are only collected from a real device.")
            return []
        target = Path(outdir or tempfile.mkdtemp(prefix="ios-crash-"))
        target.mkdir(parents=True, exist_ok=True)
        # -k leaves the reports on the device, so a later run can still see them.
        _run(["idevicecrashreport", "-u", self.udid, "-k", "-e", str(target)], timeout=300)
        reports = [
            (path.name, path.stat().st_mtime, path.read_text(errors="ignore"))
            for path in target.rglob("*.ips")
        ]
        return ios_crash_reports(
            reports, self.ios_bundle_id, self.ios_process_name, float(since_epoch)
        )

    def now_epoch(self):
        return time.time()
