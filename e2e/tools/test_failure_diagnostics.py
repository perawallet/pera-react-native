from pathlib import Path

import pytest
from robot import run


RESOURCE = Path(__file__).resolve().parents[1] / 'resources/app.resource'


@pytest.mark.parametrize('probe, screenshot', [('empty', True), ('secret', False), ('error', False)])
def test_failure_screenshot_requires_a_successful_secret_check(tmp_path, probe, screenshot):
    marker = tmp_path / 'screenshot.txt'
    suite = tmp_path / 'diagnostics.robot'
    suite.write_text(f'''*** Settings ***
Resource    {RESOURCE}
Library    OperatingSystem
Test Teardown    Capture Failure Screenshot
*** Test Cases ***
Failure
    Fail    Expected failure
*** Keywords ***
Get Webelements
    [Arguments]    ${{locator}}
    IF    '{probe}' == 'error'    Fail    Driver unavailable
    IF    '{probe}' == 'empty'    Fail    Element locator '${{locator}}' did not match any elements.
    ${{elements}}=    Create List
    IF    '{probe}' == 'secret'
        ${{field}}=    Evaluate    object()
        Append To List    ${{elements}}    ${{field}}
    END
    RETURN    ${{elements}}
Capture Page Screenshot
    [Arguments]    ${{path}}
    Create File    {marker}    captured
''')
    status = run(str(suite), variable=['PLATFORM:android'], outputdir=str(tmp_path),
                 log='NONE', report='NONE', console='none')
    assert status == 1
    assert marker.exists() == screenshot
