import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "resources" / "libraries"))

from stress_probe import (  # noqa: E402
    classify,
    crash_events,
    ios_crash_reports,
    parse_am_start_total_ms,
    parse_cpuinfo_pct,
    parse_gfxinfo,
    parse_meminfo_pss_kb,
    synthetic_address,
)

THRESHOLDS = {"slow": 2000, "unusable": 5000, "timeout": 20000}
PKG = "com.algorand.perarn.staging"


def test_classify_boundaries():
    assert classify(1999, THRESHOLDS) == "ok"
    assert classify(2000, THRESHOLDS) == "slow"
    assert classify(4999, THRESHOLDS) == "slow"
    assert classify(5000, THRESHOLDS) == "unusable"


def test_classify_timeout_or_missing_reading_is_unusable():
    assert classify(10, THRESHOLDS, timed_out=True) == "unusable"
    assert classify(None, THRESHOLDS) == "unusable"


GFXINFO = """
Applications Graphics Acceleration Info:
Uptime: 1 Realtime: 1

** Graphics info for pid 1234 [com.algorand.perarn.staging] **

Stats since: 17549330226ns
Total frames rendered: 1203
Janky frames: 118 (9.81%)
Janky frames (legacy): 150 (12.47%)
50th percentile: 8ms
90th percentile: 16ms
95th percentile: 21ms
99th percentile: 48ms
Number Missing Vsync: 4
"""


def test_parse_gfxinfo():
    assert parse_gfxinfo(GFXINFO) == {
        "total_frames": 1203,
        "janky_frames": 118,
        "janky_pct": 9.81,
        "p50_ms": 8,
        "p90_ms": 16,
        "p95_ms": 21,
        "p99_ms": 48,
    }


def test_parse_gfxinfo_with_no_frames_is_empty_not_an_error():
    assert parse_gfxinfo("No process found for: com.x")["total_frames"] == 0


def test_parse_meminfo_pss_both_formats():
    new = "           TOTAL PSS:   234567            TOTAL RSS:   300000      TOTAL SWAP PSS:     1234"
    old = "        TOTAL   198765   150000    40000        0   300000   200000    90000     5000"
    assert parse_meminfo_pss_kb(new) == 234567
    assert parse_meminfo_pss_kb(old) == 198765
    assert parse_meminfo_pss_kb("No process found") is None


def test_parse_am_start_total_ms():
    out = "Starting: Intent { cmp=x }\nStatus: ok\nLaunchState: COLD\nTotalTime: 1234\nWaitTime: 1240\nComplete\n"
    assert parse_am_start_total_ms(out) == 1234
    assert parse_am_start_total_ms("Error: Activity not started") is None


def test_parse_cpuinfo_pct_sums_the_packages_processes_only():
    out = f"""Load: 1.2 / 1.0 / 0.9
CPU usage from 5000ms to 0ms ago:
  12% 1234/{PKG}: 8.5% user + 3.5% kernel / faults: 10 minor
  3.5% 1300/{PKG}:remote: 3% user + 0.5% kernel
  40% 99/com.other.app: 30% user + 10% kernel
"""
    assert parse_cpuinfo_pct(out, PKG) == 15.5
    assert parse_cpuinfo_pct("nothing here", PKG) == 0.0


LOGCAT = f"""
10-23 16:00:00.100  1234  1234 E AndroidRuntime: FATAL EXCEPTION: mqt_native_modules
10-23 16:00:00.100  1234  1234 E AndroidRuntime: Process: {PKG}, PID: 1234
10-23 16:00:00.200  777  777 E AndroidRuntime: FATAL EXCEPTION: main
10-23 16:00:00.200  777  777 E AndroidRuntime: Process: com.other.app, PID: 777
10-23 16:01:00.000  555  555 E ActivityManager: ANR in {PKG} ({PKG}/.MainActivity)
10-23 16:02:00.000  100  100 I lowmemorykiller: Kill '{PKG}' (1234), uid 10200, oom_adj 0
10-23 16:02:01.000  100  100 I lowmemorykiller: Kill 'com.other.app' (88), uid 10201
10-23 16:03:00.000  300  300 F libc    : Fatal signal 11 (SIGSEGV), code 1, fault addr 0x0 in tid 1300 (mqt_v_js), pid 1234 ({PKG})
10-23 16:04:00.000  100  100 I am_proc_died: [0,1234,{PKG},0,0]
"""


def test_crash_events_keep_this_packages_failures_only():
    events = crash_events(LOGCAT, PKG)
    kinds = [e.split(":", 1)[0] for e in events]
    assert kinds == ["crash", "anr", "low-memory-kill", "native-crash"]
    assert all("com.other.app" not in e for e in events)


def test_a_normal_process_death_is_not_a_crash():
    assert crash_events(f"I am_proc_died: [0,1234,{PKG},0,0]", PKG) == []


BUNDLE = "com.algorandllc.perarn.staging"
# The staging executable: Expo strips the spaces from the app name, "Pera 7 Staging".
PROCESS = "Pera7Staging"


def ips(header, body):
    return json.dumps(header) + "\n" + json.dumps(body)


def crash_report(bundle=BUNDLE, timestamp="2026-10-26 11:00:00.00 +0000"):
    return ips({"bug_type": "309", "bundleID": bundle, "timestamp": timestamp}, {"procName": "x"})


def jetsam_report(victims, timestamp="2026-10-26 11:05:00.00 +0000"):
    return ips({"bug_type": "298", "timestamp": timestamp}, {"processes": victims})


def test_ios_crash_reports_use_the_incident_time_not_the_file_time():
    # The file copy can carry any mtime; the report's own timestamp decides.
    since = datetime(2026, 10, 26, 10, 30, tzinfo=timezone.utc).timestamp()
    reports = [
        ("old.ips", 9e12, crash_report(timestamp="2026-10-26 09:00:00.00 +0000")),
        ("new.ips", 0.0, crash_report(timestamp="2026-10-26 11:00:00.00 +0000")),
    ]
    assert ios_crash_reports(reports, BUNDLE, PROCESS, since) == ["new.ips"]


def test_ios_crash_reports_match_the_app_by_bundle_not_by_a_substring():
    reports = [
        ("mine.ips", 0.0, crash_report()),
        ("other.ips", 0.0, crash_report(bundle="com.other.app")),
        # Mentions the app's name in prose; it is another app's report.
        ("prose.ips", 0.0, ips({"bug_type": "309", "bundleID": "com.other.app", "timestamp": "2026-10-26 11:00:00.00 +0000"}, {"note": PROCESS})),
    ]
    assert ios_crash_reports(reports, BUNDLE, PROCESS, 0) == ["mine.ips"]


def test_a_jetsam_report_counts_only_when_this_app_was_the_victim():
    killed = jetsam_report([{"name": PROCESS, "reason": "per-process-limit"}, {"name": "Other"}])
    bystander = jetsam_report([{"name": PROCESS}, {"name": "Other", "reason": "vm-pageshortage"}])
    reports = [("killed.ips", 0.0, killed), ("bystander.ips", 0.0, bystander)]
    assert ios_crash_reports(reports, BUNDLE, PROCESS, 0) == ["killed.ips"]


def test_unreadable_reports_are_skipped():
    reports = [("broken.ips", 0.0, "not json at all"), ("empty.ips", 0.0, "")]
    assert ios_crash_reports(reports, BUNDLE, PROCESS, 0) == []


def test_synthetic_address_matches_the_apps_fixture_encoding():
    assert synthetic_address(0) == "A" * 58
    assert synthetic_address(31) == "A" * 57 + "7"
    assert synthetic_address(33) == "A" * 56 + "BB"
    assert len({synthetic_address(i) for i in range(1000)}) == 1000
    assert all(len(synthetic_address(i)) == 58 for i in (0, 1, 999))
