from parity import matrix


def test_only_a_pass_on_both_platforms_is_ok():
    rows = matrix(
        {"a": "PASS", "b": "PASS", "c": "FAIL"},
        {"a": "PASS", "b": "SKIP", "d": "PASS"},
    )
    assert [(s, ok) for s, _, _, ok in rows] == [
        ("a", True),
        ("b", False),
        ("c", False),
        ("d", False),
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
