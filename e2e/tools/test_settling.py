from pathlib import Path

from robot import run


RESOURCE = Path(__file__).resolve().parents[1] / 'resources/app.resource'


def test_settling_waits_for_size_and_position_and_fails_when_motion_continues(tmp_path):
    suite = tmp_path / 'settling.robot'
    suite.write_text(f'''*** Settings ***
Resource    {RESOURCE}
*** Test Cases ***
Waits Through Resizing
    ${{frames}}=    Evaluate    [dict(x=0, y=0, width=w, height=10) for w in [10, 11, 12, 13, 13, 13, 13]]
    Set Suite Variable    ${{FRAMES}}    ${{frames}}
    Wait Until Settled    tid=button
    Length Should Be    ${{FRAMES}}    0
Never Settles
    ${{frames}}=    Evaluate    [dict(x=x, y=0, width=10, height=10) for x in range(31)]
    Set Suite Variable    ${{FRAMES}}    ${{frames}}
    Run Keyword And Expect Error    *did not stop moving or resizing*    Wait Until Settled    tid=button
*** Keywords ***
Get Webelement
    [Arguments]    ${{locator}}
    ${{element}}=    Evaluate    types.SimpleNamespace(rect=$FRAMES.pop(0))    modules=types
    RETURN    ${{element}}
Wait Until Page Contains Element
    [Arguments]    ${{locator}}    ${{timeout}}
    No Operation
Sleep
    [Arguments]    ${{duration}}
    No Operation
''')
    assert run(str(suite), variable=['PLATFORM:android'], outputdir=str(tmp_path),
               log='NONE', report='NONE', console='none') == 0
