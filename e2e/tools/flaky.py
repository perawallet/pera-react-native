"""Cases whose verdict changes between passes.

Usage: python tools/flaky.py results/flaky-android-p1 results/flaky-android-p2 [...]

A suite that is green once proves only that it can be green. A case that passes in
one pass and fails in another is flaky, and belongs nowhere near a merge gate until
the reason is known — so compare the passes rather than trusting the last one.
"""

import sys
from collections import defaultdict
from pathlib import Path

from robot.api import ExecutionResult, ResultVisitor


class _Collect(ResultVisitor):
    def __init__(self):
        self.status = {}

    def visit_test(self, test):
        ids = [t[3:] for t in test.tags if t.startswith("id:")] or [test.longname]
        for scenario in ids:
            self.status[scenario] = test.status


def collect(pass_dir):
    """Every case verdict in one pass, across its per-suite output files."""
    status = {}
    for output in sorted(Path(pass_dir).glob("*/output.xml")):
        visitor = _Collect()
        ExecutionResult(str(output)).visit(visitor)
        status.update(visitor.status)
    return status


def main(dirs):
    passes = [collect(d) for d in dirs]
    seen = defaultdict(list)
    for name, verdicts in ((n, p) for p in passes for n in p):
        seen[name].append(verdicts[name])

    flaky, missing = [], []
    for name, verdicts in sorted(seen.items()):
        if len(verdicts) < len(passes):
            missing.append((name, verdicts))
        elif len(set(verdicts)) > 1:
            flaky.append((name, verdicts))

    for name, verdicts in flaky:
        print(f"FLAKY    {name}  {' '.join(verdicts)}")
    for name, verdicts in missing:
        print(f"MISSING  {name}  ran in {len(verdicts)} of {len(passes)} passes")

    print(f"\n{len(seen)} cases over {len(passes)} passes: "
          f"{len(flaky)} flaky, {len(missing)} did not run every pass")
    return 1 if flaky else 0


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1:]))
