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
