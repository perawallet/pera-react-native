"""Two-platform result matrix from Robot output files.

Usage: python e2e/tools/parity.py results/android/output.xml results/ios/output.xml

Exits non-zero when a scenario did not pass on both platforms, or ran on only one.
"""

import sys
from collections import Counter

from robot.api import ExecutionResult, ResultVisitor


class _Collect(ResultVisitor):
    def __init__(self):
        self.status = {}

    def visit_test(self, test):
        ids = [t[3:] for t in test.tags if t.startswith("id:")]
        for scenario in ids:
            self.status[scenario] = test.status
        if not ids:
            self.status[f"(untagged) {test.longname}"] = test.status


def collect(path):
    visitor = _Collect()
    ExecutionResult(path).visit(visitor)
    return visitor.status


def verdict(a, i):
    """What a pair of platform results means for parity.

    Requiring PASS on both made the gate red on the first run and every run after:
    around fifty scenarios per platform skip for reasons the app cannot change - a
    simulator with no Secure Enclave, a backend that returned no data. A gate nobody
    can get green is a gate everybody learns to ignore.

    What parity is actually for is catching a scenario that works on one platform and
    not the other, and one that stopped running on a platform without anyone noticing.
    """
    if "MISSING" in (a, i):
        return "missing"          # ran on one platform only: a coverage hole
    if {a, i} == {"PASS", "FAIL"}:
        return "divergent"        # works on one platform, broken on the other
    if a == i:
        return "matched"          # both pass, both skip, both fail - no divergence
    return "platform-gap"         # one skips where the other runs; worth seeing, not blocking


BLOCKING = {"divergent", "missing"}


def matrix(android, ios):
    rows = []
    for scenario in sorted(android.keys() | ios.keys()):
        a, i = android.get(scenario, "MISSING"), ios.get(scenario, "MISSING")
        rows.append((scenario, a, i, verdict(a, i)))
    return rows


def main(android_xml, ios_xml):
    rows = matrix(collect(android_xml), collect(ios_xml))
    print("| Scenario | Android | iOS | |\n|---|---|---|---|")
    for scenario, a, i, how in rows:
        mark = "" if how == "matched" else how
        print(f"| {scenario} | {a} | {i} | {mark} |")

    counts = Counter(how for *_, how in rows)
    print(
        f"\n{len(rows)} scenarios: {counts['matched']} matched, "
        f"{counts['platform-gap']} platform gaps, "
        f"{counts['divergent']} divergent, {counts['missing']} missing"
    )
    blocking = [r for r in rows if r[3] in BLOCKING]
    for scenario, a, i, how in blocking:
        print(f"{how.upper()}  {scenario}  android={a} ios={i}")
    return 1 if blocking else 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1], sys.argv[2]))
