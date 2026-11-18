from datetime import timedelta
from pathlib import Path
import sys
from unittest.mock import Mock

import pytest
from robot import run
from selenium.common.exceptions import StaleElementReferenceException

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'resources/libraries'))
import PeraAppiumLibrary as library  # noqa: E402


def bounds(x=0, width=10):
    return dict(x=x, y=0, width=width, height=10)


class Element:
    def __init__(self, id_, rectangles):
        self.id = id_
        self.rectangles = iter(rectangles)

    @property
    def rect(self):
        sample = next(self.rectangles)
        if isinstance(sample, Exception):
            raise sample
        return sample


@pytest.fixture
def appium(monkeypatch):
    monkeypatch.setattr(library, 'sleep', Mock())
    return library.PeraAppiumLibrary(run_on_failure='Nothing')


def test_waits_through_resizing_without_repeating_the_locator_for_each_sample(appium, monkeypatch):
    element = Element('button', map(lambda width: bounds(width=width), [10, 11, 12, 13, 13, 13, 13]))
    find = Mock(return_value=element)
    monkeypatch.setattr(appium, '_element_find', find)

    appium.wait_until_element_settles('tid=button')

    assert library.sleep.call_count == 6
    assert find.call_count == 2


def test_reacquires_stale_element_and_restarts_the_stability_window(appium, monkeypatch):
    old = Element('old', [bounds(), bounds(), StaleElementReferenceException()])
    new = Element('new', [bounds()] * 4)
    find = Mock(side_effect=[old, None, new, new])
    monkeypatch.setattr(appium, '_element_find', find)

    appium.wait_until_element_settles('tid=button')

    assert library.sleep.call_count == 7
    assert find.call_count == 4


def test_does_not_settle_a_match_replaced_by_a_different_element(appium, monkeypatch):
    old = Element('old', [bounds()] * 4)
    new = Element('new', [bounds(x=20)] * 4)
    find = Mock(side_effect=[old, new, new])
    monkeypatch.setattr(appium, '_element_find', find)

    appium.wait_until_element_settles('tid=button')

    assert library.sleep.call_count == 7
    assert find.call_count == 3


def test_never_settles_when_position_keeps_changing(appium, monkeypatch):
    element = Element('button', map(bounds, range(31)))
    monkeypatch.setattr(appium, '_element_find', Mock(return_value=element))

    with pytest.raises(AssertionError, match='did not stop moving or resizing'):
        appium.wait_until_element_settles('tid=button')


def test_zero_timeout_runs_expect_element_once_and_propagates_failure(appium, monkeypatch):
    element = Mock()
    find = Mock(return_value=element)
    monkeypatch.setattr(appium, '_element_find', find)
    element.is_enabled.return_value = True

    appium.expect_element('tid=button', 'enabled', timeout=timedelta(0), loglevel='NONE')
    find.assert_called_once()
    element.is_enabled.assert_called_once()

    find.reset_mock()
    element.is_enabled.return_value = False
    with pytest.raises(AssertionError, match="Expected 'tid=button' to be enabled"):
        appium.expect_element('tid=button', 'enabled', timeout=timedelta(0), loglevel='NONE')
    find.assert_called_once()


def test_robot_uses_optimized_settling_and_converts_zero_timeout(appium, monkeypatch, tmp_path):
    element = Element('button', [bounds()] * 4)
    monkeypatch.setattr(Element, 'is_enabled', lambda _: True, raising=False)
    find = Mock(return_value=element)
    monkeypatch.setattr(type(appium), '_element_find', find)
    resource = Path(library.__file__).resolve().parents[1] / 'app.resource'
    suite = tmp_path / 'settling.robot'
    suite.write_text(f'''*** Settings ***
Resource    {resource}
*** Test Cases ***
Settle And Check
    Wait Until Settled    tid=button
    Expect Element    tid=button    enabled    timeout=0s    loglevel=NONE
''')

    assert run(str(suite), variable=['PLATFORM:android'], outputdir=str(tmp_path),
               log='NONE', report='NONE', console='none') == 0
    assert find.call_count == 3
