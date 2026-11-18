"""Exercise platform adapters with a stub Appium session and no device."""

import io
from pathlib import Path

from AppiumLibrary import AppiumLibrary
import pytest
from robot import run
from robot.api import ExecutionResult


ADAPTERS = Path(__file__).resolve().parents[1] / 'resources/platforms'
IPHONE_UDID = '00008101-000000000000001E'


def run_cases(tmp_path, cases, platform='ios', **variables):
    adapter = ADAPTERS / f'{platform}.resource'
    suite = tmp_path / 'cases.robot'
    suite.write_text(f'*** Settings ***\nResource    {adapter}\n\n*** Test Cases ***\n{cases}')
    return run(str(suite), outputdir=str(tmp_path), log='NONE', report='NONE',
               stdout=io.StringIO(), stderr=io.StringIO(),
               variable=[f'{name}:{value}' for name, value in variables.items()])


def test_external_wda_uses_physical_capabilities(monkeypatch, tmp_path):
    captured = {}

    def open_application(self, remote_url, **caps):
        captured.update(caps)

    monkeypatch.setattr(AppiumLibrary, 'open_application', open_application)
    result = run_cases(tmp_path, 'Open signed app\n    Open Pera\n', IOS_UDID=IPHONE_UDID,
                       IOS_DEV_CLIENT_URL='exp+test://launcher', IOS_PLATFORM_VERSION='26.7',
                       IOS_WDA_URL='http://test:8100', IOS_WDA_REMOTE_PORT='8101')
    assert result == 0
    assert captured['udid'] == IPHONE_UDID
    assert captured['platformVersion'] == '26.7'
    assert captured['webDriverAgentUrl'] == 'http://test:8100'
    assert captured['wdaRemotePort'] == 8101
    assert 'isHeadless' not in captured


@pytest.mark.parametrize('udid, camera_status', [
    (IPHONE_UDID, 'SKIP'),
    ('11111111-2222-3333-4444-555555555555', 'PASS'),
])
def test_native_capabilities_match_device_kind(tmp_path, udid, camera_status):
    assert run_cases(tmp_path, '''Camera permission
    Require Camera Permission Control
Biometrics
    Enroll Biometrics
''', IOS_UDID=udid) == 0
    tests = ExecutionResult(str(tmp_path / 'output.xml')).suite.tests
    assert [test.status for test in tests] == [camera_status, 'SKIP']


@pytest.mark.parametrize('platform', ['android', 'ios'])
@pytest.mark.parametrize('local', [True, False])
def test_session_open_failure_aborts_only_local_run(monkeypatch, tmp_path, platform, local):
    def open_application(self, remote_url, **caps):
        raise RuntimeError('test device disappeared')

    monkeypatch.setattr(AppiumLibrary, 'open_application', open_application)
    flags = {'E2E_LOCAL_RUN': 'True'} if local else {}
    result = run_cases(tmp_path, '''Missing test device
    Open Pera
Later test
    Create File    ${OUTPUT DIR}/later
''', platform=platform, IOS_UDID=IPHONE_UDID, **flags)
    assert result != 0
    marker = tmp_path / '.incomplete'
    assert marker.exists() == local
    if local:
        assert 'test device disappeared' in marker.read_text()
    assert (tmp_path / 'later').exists() != local
