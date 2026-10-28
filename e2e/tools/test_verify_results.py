import pytest
from robot.api import TestSuite as Suite

from verify_results import verify


def result(tmp_path, ids):
    suite = Suite('Result')
    for index, scenario in enumerate(ids):
        suite.tests.create(f'Test {index}', tags=[scenario]).body.create_keyword('No Operation')
    path = tmp_path / 'output.xml'
    suite.run(output=str(path), log=None, report=None)
    return str(path)


def test_every_selected_scenario_must_be_recorded_exactly_once(tmp_path):
    manifest = {'suite': ['id:a', 'id:b']}
    verify(manifest, [result(tmp_path, ['id:a', 'id:b'])])
    for ids in (['id:a'], ['id:a', 'id:a', 'id:b'], ['id:a', 'id:b', 'id:c']):
        with pytest.raises(ValueError, match='Incomplete results'):
            verify(manifest, [result(tmp_path, ids)])


def test_empty_selection_is_rejected():
    with pytest.raises(ValueError, match='No tests'):
        verify({}, [])
