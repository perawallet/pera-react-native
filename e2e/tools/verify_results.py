"""Reject partial or duplicate cloud outputs, even if every recorded test passed."""

from collections import Counter
import json
import sys

from robot.api import ExecutionResult, ResultVisitor

from selected_suites import identity


class Collect(ResultVisitor):
    def __init__(self):
        self.tests = Counter()

    def visit_test(self, test):
        self.tests[identity(test)] += 1


def verify(manifest, paths):
    expected = Counter(test for tests in manifest.values() for test in tests)
    actual = Collect()
    for path in paths:
        ExecutionResult(path).visit(actual)
    if not expected:
        raise ValueError("No tests were selected")
    missing, unexpected = expected - actual.tests, actual.tests - expected
    if missing or unexpected:
        raise ValueError(f"Incomplete results: missing={dict(missing)}, unexpected={dict(unexpected)}")


if __name__ == "__main__":
    try:
        with open(sys.argv[1], encoding="utf-8") as source:
            verify(json.load(source), sys.argv[2:])
    except Exception as error:
        print(error, file=sys.stderr)
        sys.exit(1)
