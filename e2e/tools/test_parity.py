import tempfile
from pathlib import Path

from parity import BLOCKING, matrix, outputs_under, verdict


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
    assert rows[2][2] == "MISSING" and rows[3][1] == "MISSING"


def test_empty_results_do_not_pass(tmp_path):
    from robot.api import TestSuite
    from parity import main

    result = tmp_path / 'output.xml'
    TestSuite('Empty').run(output=str(result), log=None, report=None)
    assert main(str(result), str(result)) == 1


def test_duplicate_or_missing_ids_are_rejected(tmp_path):
    import pytest
    from robot.api import TestSuite
    from parity import collect

    for tags in ([], ['id:a', 'id:b'], ['id:a']):
        suite = TestSuite('Identity')
        for name in ('First', 'Second'):
            suite.tests.create(name, tags=tags).body.create_keyword('No Operation')
        result = tmp_path / 'output.xml'
        suite.run(output=str(result), log=None, report=None)
        with pytest.raises(ValueError, match='id: tag|Duplicate scenario'):
            collect(str(result))


def test_a_pass_directory_is_read_whichever_way_the_runner_laid_it_out():
    # A full pass writes a directory per suite; a single-suite run writes straight into
    # the pass directory. Reading only the nested form let the gate be pointed at one
    # suite but never at the pass it exists to gate.
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "nested" / "accounts").mkdir(parents=True)
        (root / "nested" / "accounts" / "output.xml").touch()
        (root / "flat").mkdir()
        (root / "flat" / "output.xml").touch()

        assert outputs_under(root / "nested") == [root / "nested" / "accounts" / "output.xml"]
        assert outputs_under(root / "flat") == [root / "flat" / "output.xml"]
        assert outputs_under(root / "flat" / "output.xml") == [root / "flat" / "output.xml"]

