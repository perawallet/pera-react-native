"""Exercise the cloud runner with a local SDK stand-in; no network or device needed."""
import os
from pathlib import Path
import subprocess
import sys
import shlex

import pytest


RUNNER = Path(__file__).with_name('browserstack.sh')


@pytest.mark.parametrize('missing, partial, failing, expected', [
    ('', False, False, 0), ('accounts', False, False, 1), ('', True, False, 1), ('', False, True, 1)])
def test_cloud_runner_requires_results_from_every_selected_suite(tmp_path, missing, partial, failing, expected):
    venv = tmp_path / 'venv'
    bin_dir = venv / 'bin'
    bin_dir.mkdir(parents=True)
    for tool, module in [('python', ''), ('rebot', '-m robot.rebot')]:
        wrapper = bin_dir / tool
        wrapper.write_text(f'#!/bin/sh\nexec {shlex.quote(sys.executable)} {module} "$@"\n')
        wrapper.chmod(0o755)
    sdk = bin_dir / 'browserstack-sdk'
    sdk.write_text(f'''#!{sys.executable}
import os, sys
from pathlib import Path
from robot.run import RobotFramework
from robot import run_cli
args = [arg for arg in sys.argv[2:] if arg not in ('--chunk', '--no-pabotlib')]
argfile = args[args.index('--argumentfile') + 1]
if any(line.strip().endswith('.robot') for line in Path(argfile).read_text().splitlines()):
    sys.exit('Pabot does not support datasources in argumentfiles.')
options, paths = RobotFramework().parse_arguments(args)
if any(Path(path).stem == os.environ.get('SDK_MISSING') for path in paths):
    sys.exit(0)
if any(Path(path).stem == os.environ.get('SDK_PARTIAL') for path in paths):
    args = ['--test', 'Example', *args]
run_cli(args)
''')
    sdk.chmod(0o755)
    suites = []
    for name in ['card', 'accounts', 'excluded']:
        path = tmp_path / f'{name}.robot'
        step = 'Fail    expected failure' if failing and name == 'card' else 'No Operation'
        path.write_text(f'*** Settings ***\nTest Tags    {name}\n*** Test Cases ***\nExample\n    [Tags]    id:{name}.example\n    {step}\n')
        if partial and name == 'accounts':
            with path.open('a') as source:
                source.write(f'Second Test\n    [Tags]    id:{name}.second\n    No Operation\n')
        suites.append(str(path))
    out = tmp_path / 'results'
    env = dict(os.environ, E2E_VENV=str(venv), E2E_RESULTS_DIR=str(out),
               BROWSERSTACK_USERNAME='fake', BROWSERSTACK_ACCESS_KEY='fake',
               SDK_MISSING=missing, SDK_PARTIAL='accounts' if partial else '', E2E_PARALLEL='2',
               E2E_TIMINGS_FILE=str(tmp_path / 'timings.json'))
    result = subprocess.run(['bash', str(RUNNER), 'android', 'bs://fake', '--include',
                             'cardORaccounts', *suites], env=env, capture_output=True, text=True)
    assert result.returncode == expected, result.stdout + result.stderr
    import json
    plan = json.loads((out / 'plan.json').read_text())
    assert len(plan['jobs']) == 2
    for job in plan['jobs']:
        source = next(iter(job['cases']))
        assert Path(source).stem != 'excluded'
        assert (out / job['id'] / 'output.xml').exists() == (Path(source).stem != missing)
    assert (out / '.incomplete').exists() == bool(missing or partial)


def test_reused_results_are_rejected_and_cannot_feed_the_smoke_gate(tmp_path):
    (tmp_path / 'output.xml').write_text('stale result')
    env = dict(os.environ, BROWSERSTACK_USERNAME='fake', BROWSERSTACK_ACCESS_KEY='fake',
               E2E_RESULTS_DIR=str(tmp_path))
    result = subprocess.run(['bash', str(RUNNER), 'android', 'bs://fake'],
                            env=env, capture_output=True, text=True)
    assert result.returncode == 2
    assert (tmp_path / '.incomplete').exists()
