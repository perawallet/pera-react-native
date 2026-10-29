"""Use the real pinned process splitter, not a mock, to check batch boundaries."""
import json
import os
from pathlib import Path
import subprocess
import sys

from robot.api import ExecutionResult

from schedule import plan


TOOLS = Path(__file__).resolve().parent


def test_chunk_keeps_filtered_suites_in_the_same_robot_process(tmp_path):
    import pabot  # noqa: F401 -- provided by requirements-dev.txt

    processes = tmp_path / 'processes.txt'
    sources = []
    for name in ('card', 'discover'):
        path = tmp_path / f'{name}.robot'
        path.write_text(f'''*** Settings ***
Library    OperatingSystem
*** Test Cases ***
Selected
    [Tags]    id:{name}.selected
    ${{pid}}=    Evaluate    os.getpid()    modules=os
    Append To File    {processes}    ${{pid}}\\n
Excluded
    [Tags]    id:{name}.excluded
    Fail    The job filter must remove this case
''')
        sources.append(str(path))
    manifest = {source: [f'id:{Path(source).stem}.selected'] for source in sources}
    schedule = plan(manifest, reuse=True)
    assert len(schedule['jobs']) == 1
    plan_path = tmp_path / 'plan.json'
    plan_path.write_text(json.dumps(schedule))
    out = tmp_path / 'results'
    args = [sys.executable, '-m', 'pabot.pabot', '--processes', '1', '--chunk', '--no-pabotlib',
            '--command', sys.executable, '-m', 'robot', '--end-command',
            '--prerunmodifier', f'{TOOLS / "JobFilter.py"}:{plan_path}:job-001',
            '--variable', 'PLATFORM:android',
            '--outputdir', str(out), '--log', 'NONE', '--report', 'NONE', *sources]
    result = subprocess.run(args, cwd=tmp_path, env=os.environ.copy(), capture_output=True, text=True,
                            timeout=60)
    assert result.returncode == 0, result.stdout + result.stderr
    pids = processes.read_text().splitlines()
    assert len(pids) == 2 and len(set(pids)) == 1
    assert ExecutionResult(str(out / 'output.xml')).suite.test_count == 2


def test_failed_warm_root_cleanup_fails_the_recorded_results(tmp_path):
    from robot.api import TestSuiteBuilder as Builder
    from JobFilter import JobFilter

    sources = []
    for name in ('card', 'discover'):
        path = tmp_path / f'{name}.robot'
        path.write_text(f'*** Test Cases ***\nExample\n    [Tags]    id:{name}.example\n    No Operation\n')
        sources.append(str(path))
    planned = plan({source: [f'id:{Path(source).stem}.example'] for source in sources}, reuse=True)
    plan_path = tmp_path / 'plan.json'
    plan_path.write_text(json.dumps(planned))
    suite = Builder().build(*sources)
    suite.visit(JobFilter(str(plan_path), 'job-001'))
    assert suite.teardown.name == 'Close All Applications'
    cleanup = suite.resource.keywords.create('Close All Applications')
    cleanup.body.create_keyword('Fail', args=['expected cleanup failure'])
    output = tmp_path / 'output.xml'
    result = suite.run(variable=['PLATFORM:android'], output=str(output),
                       log='NONE', report='NONE', console='none')
    assert result.return_code == 2
    assert ExecutionResult(str(output)).statistics.total.failed == 2
