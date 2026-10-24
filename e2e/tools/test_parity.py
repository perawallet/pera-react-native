"""Run directly: python tools/test_parity.py

Plain asserts and a __main__ runner rather than pytest, which is not in
requirements.txt and so was never actually run against this file.
"""

from parity import BLOCKING, matrix, verdict


def test_a_scenario_working_on_one_platform_and_broken_on_the_other_blocks():
    assert verdict("PASS", "FAIL") == "divergent"
    assert verdict("FAIL", "PASS") == "divergent"
    assert "divergent" in BLOCKING


def test_a_scenario_that_ran_on_one_platform_only_blocks():
    assert verdict("PASS", "MISSING") == "missing"
    assert verdict("MISSING", "SKIP") == "missing"
    assert "missing" in BLOCKING


def test_the_same_result_on_both_platforms_is_parity():
    for both in ("PASS", "SKIP", "FAIL"):
        assert verdict(both, both) == "matched"


def test_a_skip_on_one_platform_is_reported_but_does_not_block():
    # Around fifty scenarios per platform skip for reasons the app cannot change.
    # Blocking on those is how a gate becomes something people route around.
    assert verdict("PASS", "SKIP") == "platform-gap"
    assert verdict("SKIP", "PASS") == "platform-gap"
    assert "platform-gap" not in BLOCKING


def test_matrix_labels_every_scenario_from_either_platform():
    rows = matrix(
        {"a": "PASS", "b": "PASS", "c": "FAIL"},
        {"a": "PASS", "b": "SKIP", "d": "PASS"},
    )
    assert [(s, how) for s, _, _, how in rows] == [
        ("a", "matched"),
        ("b", "platform-gap"),
        ("c", "missing"),
        ("d", "missing"),
    ]


if __name__ == "__main__":
    for name, case in sorted(globals().items()):
        if name.startswith("test_"):
            case()
            print(f"ok  {name}")
    print("all parity checks pass")
