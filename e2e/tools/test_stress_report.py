import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "resources" / "libraries"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from StressMetrics import StressMetrics  # noqa: E402
from NavTrace import FIXTURE_LANDING  # noqa: E402
from stress_report import hard_failures, load, readings, table  # noqa: E402

TIERS = Path(__file__).resolve().parent.parent / "stress-tiers.json"


def run(platform, tier, rows, failures=()):
    return {"platform": platform, "tier": tier, "rows": rows, "hardFailures": list(failures)}


def timing(surface, ms, verdict):
    return {"surface": surface, "ms": ms, "verdict": verdict, "fields": {}}


def test_table_has_a_cell_per_surface_tier_and_platform_and_dashes_for_gaps():
    runs = [
        run("android", "S", [timing("startup", 900, "ok")]),
        run("android", "L", [timing("startup", 2600, "slow")]),
        run("ios", "S", [timing("startup", 1100, "ok"), timing("contacts", 300, "ok")]),
    ]
    lines = table(runs).splitlines()
    assert lines[0] == "| surface | android S | android L | ios S |"
    assert "| startup | 900 ms | 2600 ms (slow) | 1100 ms |" in lines
    assert "| contacts | — | — | 300 ms |" in lines


def test_table_shows_the_worst_of_repeated_measurements():
    runs = [run("android", "S", [timing("scroll", 800, "ok"), timing("scroll", 2500, "slow")])]
    assert "| scroll | 2500 ms (slow) |" in table(runs)


def test_hard_failures_list_unusable_rows_and_recorded_crashes_but_not_slow_ones():
    runs = [
        run(
            "android",
            "XL",
            [timing("a", 2500, "slow"), timing("b", 21000, "unusable")],
            [{"surface": "c", "kind": "anr", "detail": "ANR in pkg"}],
        )
    ]
    found = hard_failures(runs)
    assert found == [
        "android XL: b unusable (21000 ms)",
        "android XL: c anr: ANR in pkg",
    ]


def test_a_surface_that_once_failed_is_not_shown_as_ok_by_a_later_good_run():
    rows = [timing("startup", None, "unusable"), timing("startup", 300, "ok")]
    runs = [run("android", "S", rows)]
    assert "| startup | (unusable) |" in table(runs)
    rows = [timing("startup", 6000, "unusable"), timing("startup", 2500, "slow"), timing("startup", 900, "ok")]
    assert "| startup | 6000 ms (unusable) |" in table([run("android", "S", rows)])


def test_among_equally_severe_readings_the_slowest_is_shown():
    rows = [timing("scroll", 2100, "slow"), timing("scroll", 4000, "slow"), timing("scroll", 2500, "slow")]
    assert "| scroll | 4000 ms (slow) |" in table([run("android", "S", rows)])


def test_a_setup_file_and_a_run_file_for_the_same_tier_are_one_column():
    setup = run("android", "L", [{"surface": "import:discovery", "ms": None, "verdict": None, "fields": {"elapsed_ms": 61000}}])
    measured = run("android", "L", [timing("startup:portfolio", 900, "ok")], [{"surface": "s", "kind": "crash", "detail": "x"}])
    # Either order: the file read last must not hide the one read first.
    for runs in ([setup, measured], [measured, setup]):
        check_merged(runs)


def check_merged(runs):
    assert table(runs).splitlines()[0] == "| surface | android L |"
    assert "| startup:portfolio | 900 ms |" in table(runs)
    assert "| import:discovery | android L | elapsed_ms=61000 |" in readings(runs)
    assert hard_failures(runs) == ["android L: s crash: x"]


def test_a_missing_reading_is_reported_not_crashed_on():
    runs = [run("android", "S", [timing("startup:am-start", None, "unusable")])]
    assert hard_failures(runs) == ["android S: startup:am-start unusable (no reading)"]
    assert "| startup:am-start | (unusable) |" in table(runs)


def test_readings_table_lists_device_samples_per_run():
    sample = {"surface": "assets:scroll", "ms": None, "verdict": None, "fields": {"janky_pct": 12.5}}
    text = readings([run("android", "L", [sample])])
    assert "| assets:scroll | android L | janky_pct=12.5 |" in text


def test_readings_leave_out_values_a_platform_could_not_take():
    sample = {"surface": "startup:idle", "ms": None, "verdict": None, "fields": {"cpu_pct": None, "pss_kb": 90000}}
    empty = {"surface": "x", "ms": None, "verdict": None, "fields": {"cpu_pct": None}}
    text = readings([run("ios", "S", [sample, empty])])
    assert "| startup:idle | ios S | pss_kb=90000 |" in text
    assert "None" not in text and "| x |" not in text


def test_metrics_library_round_trips_into_the_report(tmp_path):
    metrics = StressMetrics()
    metrics.begin_stress_run("S", "android", str(TIERS))
    metrics.start_surface_timer("startup")
    assert metrics.stop_surface_timer("startup") == "ok"
    metrics.start_surface_timer("hang")
    assert metrics.stop_surface_timer("hang", timed_out=True) == "unusable"
    metrics.record_surface_sample("assets:scroll", janky_pct=3.2)
    metrics.record_hard_failure("startup", "crash", "FATAL EXCEPTION")
    metrics.write_stress_metrics(str(tmp_path))

    loaded = load(str(tmp_path / "stress-metrics.json"))
    assert loaded["tier"] == "S" and loaded["platform"] == "android"
    assert [r["surface"] for r in loaded["rows"]] == ["startup", "hang", "assets:scroll"]
    assert hard_failures([loaded]) == [
        "android S: hang unusable (" + f"{loaded['rows'][1]['ms']:.0f}" + " ms)",
        "android S: startup crash: FATAL EXCEPTION",
    ]


def test_an_unknown_tier_is_rejected():
    metrics = StressMetrics()
    try:
        metrics.begin_stress_run("XXL", "android", str(TIERS))
    except ValueError as error:
        assert "XXL" in str(error)
    else:
        raise AssertionError("an unknown tier must be rejected")


def test_the_tier_file_is_well_formed():
    data = json.loads(TIERS.read_text())
    sizes = [data["tiers"][name] for name in ("S", "M", "L", "XL")]
    for key in ("accounts", "assets", "nfts", "transactions", "contacts", "wcSessions"):
        values = [s[key] for s in sizes]
        assert values == sorted(values)
    assert data["thresholdsMs"]["slow"] < data["thresholdsMs"]["unusable"] < data["thresholdsMs"]["timeout"]


def test_every_tier_contact_count_is_a_fixture_the_app_accepts():
    source = (
        Path(__file__).resolve().parents[2]
        / "apps/mobile/src/modules/deeplink/e2e-fixture-names.ts"
    ).read_text()
    counts = re.search(r"E2E_STRESS_CONTACT_COUNTS = \[([\d, ]+)\]", source).group(1)
    fixture_counts = {int(n) for n in counts.split(",")}
    tier_counts = {t["contacts"] for t in json.loads(TIERS.read_text())["tiers"].values()}
    assert tier_counts == fixture_counts


def test_a_timer_can_be_kept_as_a_reading_with_no_verdict(tmp_path):
    metrics = StressMetrics()
    metrics.begin_stress_run("S", "android", str(TIERS))
    metrics.start_surface_timer("import:discovery")
    metrics.stop_surface_timer_as_reading("import:discovery", "elapsed_ms")

    row = metrics.rows[0]
    assert row["verdict"] is None and row["ms"] is None
    assert row["fields"]["elapsed_ms"] >= 0


def test_metrics_can_be_written_under_another_file_name(tmp_path):
    metrics = StressMetrics()
    metrics.begin_stress_run("S", "android", str(TIERS))
    path = metrics.write_stress_metrics(str(tmp_path), "stress-setup-metrics.json")
    assert Path(path).name == "stress-setup-metrics.json"
    assert not (tmp_path / "stress-metrics.json").exists()


def test_an_external_reading_is_classified_like_a_timed_one():
    metrics = StressMetrics()
    metrics.begin_stress_run("S", "android", str(TIERS))
    assert metrics.record_surface_time("startup:am-start", 900) == "ok"
    assert metrics.record_surface_time("startup:am-start", 2500) == "slow"
    assert metrics.record_surface_time("startup:am-start", None) == "unusable"
    assert [r["ms"] for r in metrics.rows] == [900, 2500, None]


def test_the_timeout_comes_from_the_tier_file_in_seconds():
    metrics = StressMetrics()
    metrics.begin_stress_run("L", "ios", str(TIERS))
    assert metrics.stress_timeout_seconds() == 20


def test_contact_address_is_the_apps_fixture_address():
    metrics = StressMetrics()
    assert metrics.contact_address(0) == "A" * 58


def test_every_tier_fixture_lands_on_the_contacts_list_in_the_nav_trace():
    tiers = json.loads(TIERS.read_text())["tiers"].values()
    for tier in tiers:
        assert FIXTURE_LANDING[f"fixture:contacts-{tier['contacts']}"] == {
            "Contacts",
            "Contacts/ContactsList",
        }
