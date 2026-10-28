from pathlib import Path

import pytest
from robot import run


E2E = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize('fails', [False, True])
def test_warm_suites_reuse_one_session_and_replace_it_after_failure(tmp_path, fails):
    calls = tmp_path / 'calls.txt'
    library = tmp_path / 'MockSession.py'
    library.write_text(f'''from pathlib import Path
class MockSession:
    ROBOT_LIBRARY_SCOPE = 'GLOBAL'
    def __init__(self): self.active = False
    def note(self, value):
        with Path({str(calls)!r}).open('a') as output: output.write(value + '\\n')
    def open(self): self.active = True; self.note('open')
    def session_id(self):
        if not self.active: raise RuntimeError('No active session')
        return 'mock-session'
    def home(self):
        assert self.active
        self.note('home')
    def close_all_applications(self):
        if self.active: self.note('close')
        self.active = False
''')
    paths = []
    for index in range(3):
        suite = tmp_path / f'suite{index}.robot'
        action = 'Fail    expected' if fails and index == 1 else 'No Operation'
        suite.write_text(f'''*** Settings ***
Resource    {E2E / 'resources/app.resource'}
Library    {library}    AS    Mock
Suite Setup    Start Pera With Wallet
Suite Teardown    Close Pera
*** Test Cases ***
Example
    {action}
*** Keywords ***
Open Pera
    Mock.Open
Get Appium SessionId
    ${{id}}=    Mock.Session Id
    RETURN    ${{id}}
Relaunch Pera
    No Operation
Go Home
    Mock.Home
''')
        paths.append(str(suite))
    code = run(*paths, variable=['PLATFORM:android', 'E2E_REUSE_SESSION:True'],
               listener=[f'{E2E / "resources/libraries/WarmSession.py"}:Mock'],
               outputdir=str(tmp_path), log='NONE', report='NONE', console='none')
    assert code == int(fails)
    expected = ['open', 'home', 'home', 'close', 'open', 'home', 'close'] if fails else [
        'open', 'home', 'home', 'home', 'close']
    assert calls.read_text().splitlines() == expected
