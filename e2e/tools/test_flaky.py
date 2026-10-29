from flaky import classify, unreadable_reasons


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


def test_a_pass_whose_driver_session_died_cannot_be_compared():
    # Every case after the session goes failed on a connection, not on the app. One is
    # enough: half the cases in a real run carried this and a share test missed it by a
    # hair, which is not a margin to rest the judgement on.
    assert unreadable_reasons(case_count=12, setup_failures=0, session_lost=1)


def test_one_suite_collapsing_does_not_condemn_the_whole_pass():
    assert unreadable_reasons(case_count=200, setup_failures=8, session_lost=0) == []


def test_a_pass_that_is_mostly_setup_failures_cannot_be_compared():
    assert unreadable_reasons(case_count=12, setup_failures=11, session_lost=0)


def test_a_healthy_pass_has_nothing_against_it():
    assert unreadable_reasons(case_count=206, setup_failures=0, session_lost=0) == []

