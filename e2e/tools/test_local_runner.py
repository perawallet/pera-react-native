import json
import os
from pathlib import Path
import subprocess
import sys

import pytest


RUNNER = Path(__file__).with_name('run.sh')


@pytest.mark.parametrize('platform, variables', [
    ('android', {'ANDROID_UDID': 'test-device', 'ANDROID_SYSTEM_PORT': '8300',
                 'ANDROID_PACKAGE': 'test.package', 'ANDROID_ACTIVITY': 'test.Activity'}),
    ('ios', {'IOS_UDID': 'test-simulator', 'IOS_WDA_PORT': '8200',
             'IOS_BUNDLE_ID': 'test.bundle', 'IOS_DEV_CLIENT_URL': 'exp+test://client',
             'IOS_PLATFORM_VERSION': '26.7', 'IOS_WDA_REMOTE_PORT': '8100',
             'IOS_WDA_URL': 'http://test:8100'}),
])
def test_local_runner_forwards_configuration_and_preserves_snapshot(tmp_path, platform, variables):
    bin_dir = tmp_path / 'venv/bin'
    bin_dir.mkdir(parents=True)
    interpreter = bin_dir / 'python'
    interpreter.write_text(f'''#!{sys.executable}
import json, os, subprocess, sys
from unittest.mock import patch

if sys.argv[1] == '-':
    sys.argv = sys.argv[1:]
    with patch('subprocess.run', side_effect=subprocess.TimeoutExpired('adb', 5)) as adb:
        exec(sys.stdin.read())
    with open(os.environ['ADB_ARGUMENT_DUMP'], 'w') as output:
        json.dump([adb.call_args.args[0], adb.call_args.kwargs['timeout']], output)
    sys.exit(0)

with open(os.environ['ARGUMENT_DUMP'], 'w') as output:
    json.dump(sys.argv[1:], output)
sys.exit(7)
''')
    interpreter.chmod(0o755)
    out = tmp_path / 'results'
    dump = tmp_path / 'args.json'
    adb_dump = tmp_path / 'adb.json'
    env = dict(os.environ, **variables, E2E_VENV=str(bin_dir.parent),
               E2E_RESULTS_DIR=str(out), ARGUMENT_DUMP=str(dump), ADB_ARGUMENT_DUMP=str(adb_dump),
               APPIUM_URL='http://test:4723')
    result = subprocess.run(['bash', str(RUNNER), platform, '--include', 'card'],
                            env=env, capture_output=True, text=True)
    assert result.returncode == 7, result.stderr
    args = json.loads(dump.read_text())
    for name, value in dict(variables, APPIUM_URL='http://test:4723').items():
        assert f'{name}:{value}' in args
    assert args.count('E2E_LOCAL_RUN:True') == 1
    if platform == 'android':
        assert json.loads(adb_dump.read_text()) == [
            ['adb', '-s', variables['ANDROID_UDID'], 'shell', 'settings', 'put', 'secure',
             'stylus_handwriting_enabled', '0'], 5,
        ]
    assert args[-1] == str(out / 'suite-snapshot/tests')
    assert (out / 'suite-snapshot/resources/app.resource').exists()


def test_local_runner_stops_when_the_emulator_never_boots(tmp_path):
    stubs = tmp_path / 'stubs'
    stubs.mkdir()
    for name, body in {'adb': 'echo "List of devices attached"', 'emulator': ':', 'sleep': ':'}.items():
        (stubs / name).write_text(f'#!/bin/sh\n{body}\n')
        (stubs / name).chmod(0o755)
    env = {k: v for k, v in os.environ.items() if k != 'ANDROID_UDID'}
    env.update(PATH=f'{stubs}:{os.environ["PATH"]}', E2E_VENV=str(tmp_path / 'missing'),
               E2E_RESULTS_DIR=str(tmp_path / 'results'))
    result = subprocess.run(['bash', str(RUNNER), 'android'], env=env, capture_output=True, text=True)
    assert result.returncode == 2
    assert 'did not finish booting' in result.stderr


def test_local_runner_keeps_robot_exit_status_when_source_is_edited(tmp_path):
    for name in ('tools', 'tests', 'resources', 'bin'):
        (tmp_path / name).mkdir()
    runner = tmp_path / 'tools/run.sh'
    runner.write_text(RUNNER.read_text())
    interpreter = tmp_path / 'bin/python'
    interpreter.write_text(f'''#!{sys.executable}
from pathlib import Path
Path({str(runner)!r}).write_text('# Edited while Robot runs.\\n' * 1000 + 'exit 99\\n')
raise SystemExit(7)
''')
    interpreter.chmod(0o755)
    env = dict(os.environ, IOS_UDID='', IOS_WDA_PORT='8100', E2E_ONE_DEVICE='0',
               E2E_VENV=str(tmp_path), E2E_RESULTS_DIR=str(tmp_path / 'results'))

    result = subprocess.run(['bash', str(runner), 'ios'], env=env, capture_output=True, text=True)

    assert result.returncode == 7, result.stderr
    assert 'ios finished with status 7' in result.stdout


@pytest.mark.parametrize('funded, excluded', [(None, True), ('0', True), ('1', False)])
def test_local_runner_runs_funded_cases_only_when_asked(tmp_path, funded, excluded):
    bin_dir = tmp_path / 'venv/bin'
    bin_dir.mkdir(parents=True)
    interpreter = bin_dir / 'python'
    interpreter.write_text(f'''#!{sys.executable}
import json, os, sys
with open(os.environ['ARGUMENT_DUMP'], 'w') as output:
    json.dump(sys.argv[1:], output)
''')
    interpreter.chmod(0o755)
    dump = tmp_path / 'args.json'
    env = {k: v for k, v in os.environ.items() if k != 'E2E_FUNDED'}
    env.update(ANDROID_UDID='test-device', ANDROID_SYSTEM_PORT='8300', E2E_VENV=str(bin_dir.parent),
               E2E_RESULTS_DIR=str(tmp_path / 'results'), ARGUMENT_DUMP=str(dump))
    if funded is not None:
        env['E2E_FUNDED'] = funded
    result = subprocess.run(['bash', str(RUNNER), 'android'], env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    args = json.loads(dump.read_text())
    pairs = list(zip(args, args[1:]))
    assert ('--exclude', 'slow') in pairs
    assert (('--exclude', 'needs-funded') in pairs) is excluded


def test_local_runner_passes_the_fixtures_tool_path_wherever_it_is_started(tmp_path):
    # The snapshot holds only tests/ and resources/, and ${EXECDIR} is the caller's cwd.
    bin_dir = tmp_path / 'venv/bin'
    bin_dir.mkdir(parents=True)
    interpreter = bin_dir / 'python'
    interpreter.write_text(f'''#!{sys.executable}
import json, os, sys
with open(os.environ['ARGUMENT_DUMP'], 'w') as output:
    json.dump(sys.argv[1:], output)
''')
    interpreter.chmod(0o755)
    dump = tmp_path / 'args.json'
    env = dict(os.environ, ANDROID_UDID='test-device', ANDROID_SYSTEM_PORT='8300',
               E2E_VENV=str(bin_dir.parent), E2E_RESULTS_DIR=str(tmp_path / 'results'),
               ARGUMENT_DUMP=str(dump))
    result = subprocess.run(['bash', str(RUNNER), 'android'], env=env, cwd=tmp_path,
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    args = json.loads(dump.read_text())
    tool = RUNNER.with_name('testnet_fixtures.mjs')
    assert ('--variable', f'TESTNET_FIXTURES_TOOL:{tool}') in list(zip(args, args[1:]))
    assert tool.exists()
