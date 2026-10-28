"""Two-platform result matrix from Robot output files.

Usage: python e2e/tools/parity.py results/android/output.xml results/ios/output.xml

Exits non-zero when a scenario did not pass on both platforms, or ran on only one.
"""

import sys

from robot.api import ExecutionResult, ResultVisitor


class _Collect(ResultVisitor):
    def __init__(self):
        self.status = {}

    def visit_test(self, test):
        ids = [t[3:] for t in test.tags if t.startswith("id:")]
        if len(ids) != 1 or not ids[0]:
            raise ValueError(f"{test.longname}: expected exactly one nonempty id: tag")
        scenario = ids[0]
        if scenario in self.status:
            raise ValueError(f"Duplicate scenario id: {scenario}")
        self.status[scenario] = test.status


def collect(path):
    visitor = _Collect()
    ExecutionResult(path).visit(visitor)
    return visitor.status


def matrix(android, ios):
    rows = []
    for scenario in sorted(android.keys() | ios.keys()):
        a, i = android.get(scenario, "MISSING"), ios.get(scenario, "MISSING")
        rows.append((scenario, a, i, a == i == "PASS"))
    return rows


def main(android_xml, ios_xml):
    rows = matrix(collect(android_xml), collect(ios_xml))
    print("| Scenario | Android | iOS |\n|---|---|---|")
    for scenario, a, i, _ in rows:
        print(f"| {scenario} | {a} | {i} |")
    return 0 if rows and all(ok for *_, ok in rows) else 1


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1], sys.argv[2]))
