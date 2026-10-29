import pytest
from robot.errors import DataError

from selected_suites import selected_suites


@pytest.fixture
def suites(tmp_path):
    paths = []
    for name, tags in [('card', 'card'), ('accounts', 'accounts'), ('funded', 'card    needs-funded')]:
        path = tmp_path / f'{name}.robot'
        path.write_text(f'*** Settings ***\nTest Tags    {tags}\n*** Test Cases ***\nExample\n    No Operation\n')
        paths.append(str(path))
    return paths


def test_filters_before_allocating_sessions(suites):
    assert selected_suites(['--include', 'card', '--exclude', 'needs-funded', *suites]) == [suites[0]]


def test_single_file_is_not_lost(suites):
    assert selected_suites(['--include', 'accounts', suites[1]]) == [suites[1]]


def test_no_matching_tests_is_an_error(suites):
    with pytest.raises(DataError, match='contains no tests'):
        selected_suites(['--include', 'missing', *suites])
