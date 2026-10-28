"""Compare navigation flows of the same scenarios on Android and iOS.

Usage: python e2e/tools/flow_diff.py <android>/nav-flows.json <ios>/nav-flows.json

The scenario is the intended flow; a platform that took a different path, or raised
a navigation red flag (double open, leak, bounce), is listed. Exits non-zero if any.
"""

import json
import sys


def diff(android, ios):
    findings = []
    if not android and not ios:
        return [("(run)", "neither platform recorded any scenarios")]
    for scenario in sorted(android.keys() | ios.keys()):
        a, i = android.get(scenario), ios.get(scenario)
        if not a or not i:
            findings.append((scenario, f"ran only on {'android' if a else 'ios'}"))
            continue
        if a["flow"] and i["flow"] and a["flow"] != i["flow"]:
            findings.append((scenario, "flow differs:\n    android " + " > ".join(a["flow"]) + "\n    ios     " + " > ".join(i["flow"])))
        for platform, run in (("android", a), ("ios", i)):
            if not run["flow"]:
                findings.append((scenario, f"{platform} has no navigation trace"))
            if run.get("status") != "PASS":
                findings.append((scenario, f"{platform} status is {run.get('status', 'MISSING')}"))
            findings += [(scenario, f"{platform} {flag}") for flag in run["flags"]]
    return findings


def main(android_path, ios_path):
    with open(android_path) as f:
        android = json.load(f)
    with open(ios_path) as f:
        ios = json.load(f)
    findings = diff(android, ios)
    for scenario, finding in findings:
        print(f"{scenario}: {finding}")
    return 1 if findings else 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1], sys.argv[2]))
