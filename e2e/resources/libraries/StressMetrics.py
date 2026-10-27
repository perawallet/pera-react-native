"""Timers, device samples and hard failures for a stress run, written as stress-metrics.json.

One run is one tier on one platform. The thresholds come from stress-tiers.json, the single place
tier sizes and verdict limits are defined; stress_report.py turns the files of several runs into
the results table.
"""

import json
import time
from datetime import datetime, timezone
from pathlib import Path

from stress_probe import classify, synthetic_address


class StressMetrics:
    ROBOT_LIBRARY_SCOPE = "GLOBAL"

    def __init__(self):
        self.tier = None
        self.platform = None
        self.tier_sizes = {}
        self.thresholds = {}
        self.rows = []
        self.hard_failures = []
        self._started = {}

    def begin_stress_run(self, tier, platform, tiers_path):
        data = json.loads(Path(tiers_path).read_text())
        if tier not in data["tiers"]:
            raise ValueError(f"Unknown tier {tier!r}; stress-tiers.json defines {sorted(data['tiers'])}")
        self.tier, self.platform = tier, platform
        self.tier_sizes = data["tiers"][tier]
        self.thresholds = data["thresholdsMs"]
        self.rows, self.hard_failures, self._started = [], [], {}
        return self.tier_sizes

    def start_surface_timer(self, surface):
        self._started[surface] = time.perf_counter()

    def stop_surface_timer(self, surface, timed_out=False):
        """Records the elapsed time under `surface` and returns its verdict."""
        elapsed_ms = (time.perf_counter() - self._started.pop(surface)) * 1000
        # Robot passes a ${False} default as a bool and a command-line override as text.
        timed_out = timed_out is True or str(timed_out).lower() == "true"
        verdict = classify(elapsed_ms, self.thresholds, timed_out=timed_out)
        self._add(surface, round(elapsed_ms), verdict, {})
        return verdict

    def stop_surface_timer_as_reading(self, surface, field="elapsed_ms"):
        """Keeps the elapsed time as a reading with no verdict, for a step that is slow by nature."""
        elapsed_ms = round((time.perf_counter() - self._started.pop(surface)) * 1000)
        self._add(surface, None, None, {field: elapsed_ms})
        return elapsed_ms

    def record_surface_time(self, surface, ms, timed_out=False):
        """Records a duration measured outside Robot (such as `am start -W`) and returns its verdict."""
        timed_out = timed_out is True or str(timed_out).lower() == "true"
        verdict = classify(ms, self.thresholds, timed_out=timed_out)
        self._add(surface, None if ms is None else round(ms), verdict, {})
        return verdict

    def stress_timeout_seconds(self):
        """How long a wait may run before the target counts as never having appeared."""
        return self.thresholds["timeout"] / 1000

    def contact_address(self, index):
        """The address the stress contact fixtures give contact `index`."""
        return synthetic_address(int(index))

    def record_surface_sample(self, surface, **fields):
        """A device reading (frames, memory, CPU) that has no duration of its own."""
        self._add(surface, None, None, fields)

    def record_hard_failure(self, surface, kind, detail):
        self.hard_failures.append({"surface": surface, "kind": kind, "detail": detail})

    def write_stress_metrics(self, outdir=None, filename="stress-metrics.json"):
        if outdir is None:
            from robot.libraries.BuiltIn import BuiltIn

            outdir = BuiltIn().get_variable_value("${OUTPUT DIR}")
        path = Path(outdir) / filename
        path.write_text(
            json.dumps(
                {
                    "tier": self.tier,
                    "platform": self.platform,
                    "rows": self.rows,
                    "hardFailures": self.hard_failures,
                },
                indent=2,
            )
        )
        return str(path)

    def _add(self, surface, ms, verdict, fields):
        self.rows.append(
            {
                "surface": surface,
                "ms": ms,
                "verdict": verdict,
                "fields": fields,
                "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
        )
