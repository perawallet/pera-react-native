"""Pure parsers and the verdict classifier for the stress scenarios.

Everything here takes text a device tool already printed and returns plain data, so it can be
tested without a device. DeviceProbe.py runs the tools; StressMetrics.py records the results.
"""

import json
import re
from datetime import datetime
from typing import Iterable, Optional


def classify(ms: Optional[float], thresholds: dict, timed_out: bool = False) -> str:
    """`ok`, `slow` (soft degradation) or `unusable`; a missing reading counts as unusable."""
    if timed_out or ms is None:
        return "unusable"
    if ms >= thresholds["unusable"]:
        return "unusable"
    if ms >= thresholds["slow"]:
        return "slow"
    return "ok"


def _int(pattern: str, text: str) -> Optional[int]:
    found = re.search(pattern, text, re.MULTILINE)
    return int(found.group(1)) if found else None


def parse_gfxinfo(text: str) -> dict:
    """Frame totals and percentiles from `dumpsys gfxinfo <package>`; zeros when it saw no frames."""
    janky = re.search(r"^Janky frames: (\d+) \(([\d.]+)%\)", text, re.MULTILINE)
    return {
        "total_frames": _int(r"^Total frames rendered: (\d+)", text) or 0,
        "janky_frames": int(janky.group(1)) if janky else 0,
        "janky_pct": float(janky.group(2)) if janky else 0.0,
        "p50_ms": _int(r"^50th percentile: (\d+)ms", text) or 0,
        "p90_ms": _int(r"^90th percentile: (\d+)ms", text) or 0,
        "p95_ms": _int(r"^95th percentile: (\d+)ms", text) or 0,
        "p99_ms": _int(r"^99th percentile: (\d+)ms", text) or 0,
    }


def parse_meminfo_pss_kb(text: str) -> Optional[int]:
    """Total PSS from `dumpsys meminfo <package>`, in either its summary or its table layout."""
    return _int(r"TOTAL PSS:\s+(\d+)", text) or _int(r"^\s*TOTAL\s+(\d+)", text)


def parse_am_start_total_ms(text: str) -> Optional[int]:
    """`TotalTime` from `am start -W`: launch request to first frame drawn."""
    return _int(r"^TotalTime: (\d+)", text)


def parse_cpuinfo_pct(text: str, package: str) -> float:
    """Summed CPU share of the package's processes in `dumpsys cpuinfo`; 0.0 when it is absent."""
    total = 0.0
    for line in text.splitlines():
        found = re.match(r"\s*([\d.]+)%\s+\d+/" + re.escape(package) + r"[:\s]", line)
        if found:
            total += float(found.group(1))
    return round(total, 1)


def crash_events(logcat_text: str, package: str) -> list:
    """Failures the log shows for `package`, each prefixed with its kind.

    A plain process death is deliberately not one: every relaunch the suite performs ends the
    process, so `am_proc_died` would flag a healthy run.
    """
    lines = logcat_text.splitlines()
    events = []
    for i, line in enumerate(lines):
        if "FATAL EXCEPTION" in line and any(f"Process: {package}," in l for l in lines[i + 1 : i + 4]):
            events.append(f"crash: {line.strip()}")
        elif f"ANR in {package}" in line:
            events.append(f"anr: {line.strip()}")
        elif "lowmemorykiller" in line and f"'{package}'" in line:
            events.append(f"low-memory-kill: {line.strip()}")
        elif "Fatal signal" in line and f"({package})" in line:
            events.append(f"native-crash: {line.strip()}")
    return events


def _ips(text: str):
    """The header and body of an `.ips` report, which is two JSON documents, or None if unreadable."""
    head, _, rest = text.partition("\n")
    try:
        header = json.loads(head)
    except ValueError:
        return None
    try:
        body = json.loads(rest) if rest.strip() else {}
    except ValueError:
        body = {}
    return (header, body) if isinstance(header, dict) and isinstance(body, dict) else None


def _incident_epoch(header: dict, modified: float) -> float:
    """When the incident happened, from the report; the copied file's time only as a last resort."""
    stamp = header.get("timestamp")
    try:
        # "2026-10-26 11:00:00.00 +0000": whole seconds and the offset are enough.
        return datetime.strptime(f"{stamp[:19]} {stamp.split()[-1]}", "%Y-%m-%d %H:%M:%S %z").timestamp()
    except (AttributeError, ValueError, IndexError):
        return modified


def _is_this_app(header: dict, body: dict, bundle_id: str, process_name: str) -> bool:
    if header.get("bundleID") == bundle_id or body.get("procName") == process_name:
        return True
    # A jetsam report lists every process; it is this app's only if the app is one it killed.
    return any(
        isinstance(p, dict) and p.get("name") == process_name and "reason" in p
        for p in body.get("processes", [])
    )


def ios_crash_reports(
    reports: Iterable[tuple], bundle_id: str, process_name: str, since_epoch: float
) -> list:
    """Names of the crash, jetsam and cpu_resource reports for this app from `since_epoch` on.

    `reports` holds (file name, modification epoch, text). A report is matched on what it declares
    (its bundle id, its process name, or being a jetsam victim) rather than on its text, and dated
    by its own timestamp, because the copy off the device does not keep the incident time.
    """
    found = []
    for name, modified, text in reports:
        parsed = _ips(text)
        if parsed is None:
            continue
        header, body = parsed
        if _incident_epoch(header, modified) >= since_epoch and _is_this_app(
            header, body, bundle_id, process_name
        ):
            found.append(name)
    return found


_BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"


def synthetic_address(index: int) -> str:
    """The address the app's stress contact fixtures give contact `index`.

    Mirrors syntheticAddress in apps/mobile/src/modules/deeplink/handlers/useE2eFixtureDeeplink.ts;
    change both together.
    """
    digits = ""
    rest = index
    while True:
        digits = _BASE32[rest % 32] + digits
        rest //= 32
        if rest == 0:
            break
    return digits.rjust(58, "A")
