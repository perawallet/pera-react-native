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
             'IOS_BUNDLE_ID': 'test.bundle', 'IOS_DEV_CLIENT_URL': 'exp+test://client'}),
])
def test_local_runner_forwards_configuration_and_preserves_snapshot(tmp_path, platform, variables):
    bin_dir = tmp_path / 'venv/bin'
    bin_dir.mkdir(parents=True)
    interpreter = bin_dir / 'python'
    interpreter.write_text(f'''#!{sys.executable}
import json, os, sys
with open(os.environ['ARGUMENT_DUMP'], 'w') as output:
    json.dump(sys.argv[1:], output)
sys.exit(7)
''')
    interpreter.chmod(0o755)
    out = tmp_path / 'results'
    dump = tmp_path / 'args.json'
    env = dict(os.environ, **variables, E2E_VENV=str(bin_dir.parent),
               E2E_RESULTS_DIR=str(out), ARGUMENT_DUMP=str(dump), APPIUM_URL='http://test:4723')
    result = subprocess.run(['bash', str(RUNNER), platform, '--include', 'card'],
                            env=env, capture_output=True, text=True)
    assert result.returncode == 7, result.stderr
    args = json.loads(dump.read_text())
    for name, value in dict(variables, APPIUM_URL='http://test:4723').items():
        assert f'{name}:{value}' in args
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
