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


# A device that dies mid-pass leaves readable output: every suite after it fails in
# setup. Those are not verdicts about the cases, and comparing them against a healthy
# pass reported a hundred and thirty-nine "flaky" cases that were nothing of the kind.
DEAD_RUN_SHARE = 0.5


class _Collect(ResultVisitor):
    def __init__(self):
        self.status = {}
        self.setup_failures = 0

    def visit_test(self, test):
        ids = [t[3:] for t in test.tags if t.startswith("id:")] or [test.longname]
        for scenario in ids:
            self.status[scenario] = test.status
        if test.status == "FAIL" and "suite setup failed" in (test.message or "").lower():
            self.setup_failures += 1


def collect(pass_dir):
    """Every case verdict in one pass, across its per-suite output files.

    Reports the suites it could not read rather than returning a short list: a pass
    that stopped halfway otherwise looks like a pass where those cases simply were
    not flaky, and the comparison comes out clean on evidence that is not there.
    """
    status, unreadable = {}, []
    setup_failures = 0
    outputs = sorted(Path(pass_dir).glob("*/output.xml"))
    if not outputs:
        unreadable.append(f"{pass_dir}: no suite output at all")
    for output in outputs:
        try:
            visitor = _Collect()
            ExecutionResult(str(output)).visit(visitor)
        except Exception as error:                       # a truncated or still-being-written file
            unreadable.append(f"{output.parent.name}: {type(error).__name__}")
            continue
        status.update(visitor.status)
        setup_failures += visitor.setup_failures

    if status and setup_failures / len(status) > DEAD_RUN_SHARE:
        unreadable.append(
            f"{setup_failures} of {len(status)} cases failed in suite setup - "
            "the device went away mid-pass, so these are not verdicts about the cases"
        )
    return status, unreadable


def main(dirs):
    collected = [collect(d) for d in dirs]
    passes = [status for status, _ in collected]

    broken = [(d, problems) for d, (_, problems) in zip(dirs, collected) if problems]
    for pass_dir, problems in broken:
        for problem in problems:
            print(f"INCOMPLETE  {pass_dir}  {problem}")
    if broken:
        print("\nA pass that did not finish cannot be compared; rerun it.")
        return 2
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
