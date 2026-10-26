"""Surface-by-tier results table from stress-metrics.json files.

Usage: python e2e/tools/stress_report.py results/android/stress-metrics.json results/ios/stress-metrics.json

Prints the timings, the device readings and the hard failures. Where a surface was measured more
than once in a run, the table shows the worst measurement.
"""

import json
import sys

TIER_ORDER = ["S", "M", "L", "XL"]
SEVERITY = {"ok": 0, "slow": 1, "unusable": 2}


def load(path):
    with open(path) as handle:
        return json.load(handle)


def _tier_rank(tier):
    return TIER_ORDER.index(tier) if tier in TIER_ORDER else len(TIER_ORDER)


def _columns(runs):
    return sorted({(r["platform"], r["tier"]) for r in runs}, key=lambda c: (c[0], _tier_rank(c[1])))


def merge(runs):
    """One run per platform and tier: the setup file and the measurement file of a tier belong together."""
    merged = {}
    for run in runs:
        key = (run["platform"], run["tier"])
        if key not in merged:
            merged[key] = {**run, "rows": [], "hardFailures": []}
        merged[key]["rows"].extend(run["rows"])
        merged[key]["hardFailures"].extend(run["hardFailures"])
    return list(merged.values())


def _timings(run):
    """The worst reading per surface: the most severe verdict, and the slowest among equals."""
    worst = {}
    for row in run["rows"]:
        if row["verdict"] is None:
            continue
        previous = worst.get(row["surface"])
        if previous is None or _rank(row) > _rank(previous):
            worst[row["surface"]] = row
    return worst


def _rank(row):
    return (SEVERITY[row["verdict"]], row["ms"] or 0)


def _ms(row):
    return "no reading" if row["ms"] is None else f"{row['ms']:.0f} ms"


def _cell(row):
    if row is None:
        return "—"
    text = f"{row['ms']:.0f} ms" if row["ms"] is not None else ""
    return text if row["verdict"] == "ok" else f"{text} ({row['verdict']})".strip()


def table(runs):
    runs = merge(runs)
    columns = _columns(runs)
    by_column = {(r["platform"], r["tier"]): _timings(r) for r in runs}
    surfaces = sorted({s for timings in by_column.values() for s in timings})
    header = "| surface | " + " | ".join(f"{p} {t}" for p, t in columns) + " |"
    divider = "|" + " --- |" * (len(columns) + 1)
    lines = [header, divider]
    for surface in surfaces:
        cells = [_cell(by_column[c].get(surface)) for c in columns]
        lines.append(f"| {surface} | " + " | ".join(cells) + " |")
    return "\n".join(lines)


def readings(runs):
    runs = merge(runs)
    lines = ["| surface | run | readings |", "| --- | --- | --- |"]
    for run in sorted(runs, key=lambda r: (r["platform"], _tier_rank(r["tier"]))):
        for row in run["rows"]:
            fields = {k: v for k, v in row["fields"].items() if v is not None}
            if row["verdict"] is None and fields:
                values = ", ".join(f"{k}={v}" for k, v in fields.items())
                lines.append(f"| {row['surface']} | {run['platform']} {run['tier']} | {values} |")
    return "\n".join(lines)


def hard_failures(runs):
    runs = merge(runs)
    found = []
    for run in sorted(runs, key=lambda r: (r["platform"], _tier_rank(r["tier"]))):
        where = f"{run['platform']} {run['tier']}"
        for row in run["rows"]:
            if row["verdict"] == "unusable":
                found.append(f"{where}: {row['surface']} unusable ({_ms(row)})")
        for failure in run["hardFailures"]:
            found.append(f"{where}: {failure['surface']} {failure['kind']}: {failure['detail']}")
    return found


def main(paths):
    runs = [load(p) for p in paths]
    print("## Timings\n")
    print(table(runs))
    print("\n## Device readings\n")
    print(readings(runs))
    failures = hard_failures(runs)
    print("\n## Hard failures\n")
    print("\n".join(f"- {f}" for f in failures) if failures else "None")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
