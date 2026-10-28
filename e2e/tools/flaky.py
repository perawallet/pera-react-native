"""Cases whose verdict changes between passes.

Usage: python tools/flaky.py results/flaky-android-p1 results/flaky-android-p2 [...]

A suite that is green once proves only that it can be green. A case that passes in
one pass and fails in another is flaky, and belongs nowhere near a merge gate until
the reason is known — so compare the passes rather than trusting the last one.

Compare passes from the same code. This reports a verdict that changed, which is
what flakiness looks like, but it is also what a fix looks like: run it across a
commit that repaired three cases and it will name those three as flaky.
"""

import sys
from collections import defaultdict
from pathlib import Path

from robot.api import ExecutionResult, ResultVisitor


# A device that dies mid-pass leaves readable output: every suite after it fails in
# setup. Those are not verdicts about the cases, and comparing them against a healthy
# pass reported a hundred and thirty-nine "flaky" cases that were nothing of the kind.
DEAD_RUN_SHARE = 0.5

# A driver session that dies takes every verdict after it with it: those cases failed on a
# connection, not on the app. One is enough to make a pass unreadable, where suite setups
# failing only mean a dead device in bulk - a single suite can collapse on its own merits.
# Half the cases in one accounts run carried these and the share test missed it by a hair,
# which is the sort of margin a judgement like this should not rest on.
SESSION_LOST = (
    "invalidsessionid",
    "nosuchdriver",
    "session is either terminated",
    "remotedisconnected",
    "connection aborted",
)


class _Collect(ResultVisitor):
    def __init__(self):
        self.status = {}
        self.setup_failures = 0
        self.session_lost = 0

    def visit_test(self, test):
        ids = [t[3:] for t in test.tags if t.startswith("id:")] or [test.longname]
        for scenario in ids:
            self.status[scenario] = test.status
        if test.status != "FAIL":
            return
        message = (test.message or "").lower()
        if "suite setup failed" in message:
            self.setup_failures += 1
        if any(signature in message for signature in SESSION_LOST):
            self.session_lost += 1


def collect(pass_dir):
    """Every case verdict in one pass, across its per-suite output files.

    Reports the suites it could not read rather than returning a short list: a pass
    that stopped halfway otherwise looks like a pass where those cases simply were
    not flaky, and the comparison comes out clean on evidence that is not there.
    """
    status, unreadable = {}, []
    setup_failures = session_lost = 0
    # A full pass writes one directory per suite; a single-suite run writes straight into
    # the pass directory. Reading only the first called a perfectly good single-suite run
    # incomplete and refused to compare it.
    outputs = sorted(Path(pass_dir).glob("output.xml"))
    outputs += sorted(Path(pass_dir).glob("*/output.xml"))
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
        session_lost += visitor.session_lost

    unreadable += unreadable_reasons(len(status), setup_failures, session_lost)
    return status, unreadable


def unreadable_reasons(case_count, setup_failures, session_lost):
    """Why a pass cannot be compared, if it cannot."""
    reasons = []
    if session_lost:
        reasons.append(
            f"{session_lost} cases failed on a driver session that was already gone - "
            "the device or Appium went away mid-pass, so these are not verdicts about the cases"
        )
    if case_count and setup_failures / case_count > DEAD_RUN_SHARE:
        reasons.append(
            f"{setup_failures} of {case_count} cases failed in suite setup - "
            "the device went away mid-pass, so these are not verdicts about the cases"
        )
    return reasons


def classify(seen, pass_count):
    """Split the cases into the ones worth acting on, by how their verdicts differ.

    A case that passes once and fails once has an unstable verdict. One that passes
    once and skips once does not: skips here are the suite stating a condition it ran
    under - no backend key, a flag off, an intro screen a device only shows once - so
    calling those flaky buries the few cases that really do change their mind among
    dozens that simply were not asked.
    """
    flaky, conditional, missing = [], [], []
    for name, verdicts in sorted(seen.items()):
        if len(verdicts) < pass_count:
            missing.append((name, verdicts))
        elif len(set(verdicts)) == 1:
            continue
        elif "FAIL" in verdicts:
            flaky.append((name, verdicts))
        else:
            conditional.append((name, verdicts))
    return flaky, conditional, missing


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
    for name, pass_status in ((n, p) for p in passes for n in p):
        seen[name].append(pass_status[name])

    flaky, conditional, missing = classify(seen, len(passes))

    for name, verdicts in flaky:
        print(f"FLAKY        {name}  {' '.join(verdicts)}")
    for name, verdicts in conditional:
        print(f"CONDITIONAL  {name}  {' '.join(verdicts)}")
    for name, verdicts in missing:
        print(f"MISSING      {name}  ran in {len(verdicts)} of {len(passes)} passes")

    print(f"\n{len(seen)} cases over {len(passes)} passes: {len(flaky)} flaky, "
          f"{len(conditional)} ran only under some conditions, "
          f"{len(missing)} did not run every pass")
    return 1 if flaky else 0


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1:]))
