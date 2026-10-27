"""Run directly: python tools/test_flaky.py

Plain asserts and a __main__ runner, to match the other tool checks: pytest is not
in requirements.txt, so a pytest-style file here would never actually be run.
"""

from flaky import classify


def test_a_case_that_passes_once_and_fails_once_is_flaky():
    flaky, conditional, missing = classify({"a": ["PASS", "FAIL"]}, 2)
    assert flaky == [("a", ["PASS", "FAIL"])]
    assert (conditional, missing) == ([], [])


def test_a_case_that_fails_once_and_skips_once_is_flaky():
    # The skip says nothing about the failure; the failure still happened.
    flaky, _, _ = classify({"a": ["FAIL", "SKIP"]}, 2)
    assert flaky == [("a", ["FAIL", "SKIP"])]


def test_a_case_that_passes_once_and_skips_once_is_only_conditional():
    # Skips state a condition the pass ran under - no backend key, a flag off, an
    # intro screen a device shows once. Calling these flaky buries the real ones.
    flaky, conditional, _ = classify({"a": ["PASS", "SKIP"]}, 2)
    assert flaky == []
    assert conditional == [("a", ["PASS", "SKIP"])]


def test_a_steady_verdict_is_reported_as_neither():
    for steady in ("PASS", "SKIP", "FAIL"):
        assert classify({"a": [steady, steady]}, 2) == ([], [], [])


def test_a_case_absent_from_a_pass_is_missing_rather_than_flaky():
    flaky, conditional, missing = classify({"a": ["PASS"]}, 2)
    assert missing == [("a", ["PASS"])]
    assert (flaky, conditional) == ([], [])


if __name__ == "__main__":
    for name, case in sorted(globals().items()):
        if name.startswith("test_"):
            case()
            print(f"ok  {name}")
    print("all flaky checks pass")
