from collections import Counter
import json
from pathlib import Path

import pytest
from robot.api import ExecutionResult, TestSuite as Suite

from schedule import load_history, plan, record


def manifest(**counts):
    return {f'/tests/{name}.robot': [f'id:{name}.case-{i}' for i in range(count)]
            for name, count in counts.items()}


def flattened(jobs):
    return Counter(case for job in jobs for cases in job['cases'].values() for case in cases)


def test_splits_large_independent_suites_without_changing_coverage():
    selection = manifest(multisig=33, swap=34, onboarding=12, security=12)
    result = plan(selection, budget=400)
    assert flattened(result['jobs']) == Counter(case for cases in selection.values() for case in cases)
    for name in ('multisig', 'swap'):
        assert sum(f'/tests/{name}.robot' in job['cases'] for job in result['jobs']) > 1
    for name in ('onboarding', 'security'):
        assert sum(f'/tests/{name}.robot' in job['cases'] for job in result['jobs']) == 1
    assert all(not job['reuse_session'] for job in result['jobs'])


def test_warm_packing_is_opt_in_and_keeps_mutating_suites_isolated():
    selection = manifest(card=2, discover=3, settings=2, security=2)
    assert len(plan(selection)['jobs']) == 4
    jobs = plan(selection, reuse=True)['jobs']
    assert len(jobs) == 3
    for job in jobs:
        if job['reuse_session']:
            assert {Path(source).stem for source in job['cases']} == {'card', 'discover'}
        else:
            assert len(job['cases']) == 1


def test_measured_durations_take_priority_and_are_platform_specific():
    selection = manifest(card=1, multisig=5)
    history = {'contexts': {'ios': {'tests': {'id:card.case-0': [1000, 1100, 1200]}}}}
    ios = plan(selection, history, context='ios')['jobs']
    android = plan(selection, history, context='android')['jobs']
    assert Path(next(iter(ios[0]['cases']))).stem == 'card'
    assert Path(next(iter(android[0]['cases']))).stem == 'multisig'


def test_invalid_samples_do_not_drive_the_schedule():
    selection = manifest(card=1)
    history = {'contexts': {'ios': {'tests': {'id:card.case-0': [None, -1, True, '300', float('nan')]}}}}
    assert plan(selection, history, context='ios')['jobs'] == plan(selection)['jobs']
    with pytest.raises(ValueError):
        plan(selection, budget=3600)
    with pytest.raises(ValueError):
        plan(selection, workers=0)
    with pytest.raises(ValueError):
        plan({'x.robot': ['id:a'], 'y.robot': ['id:a']})


def test_corrupt_or_missing_history_is_only_a_cache_miss(tmp_path):
    path = tmp_path / 'timings.json'
    assert load_history(path)['version'] == 1
    path.write_text('{broken')
    assert load_history(path)['version'] == 1
    path.write_text('[]')
    assert load_history(path)['version'] == 1


def test_history_records_successful_real_timings_only_and_bounds_samples(tmp_path):
    suite = Suite('Timings')
    suite.tests.create('Pass', tags=['id:a']).body.create_keyword('Sleep', args=['0.11s'])
    suite.tests.create('Fail', tags=['id:b']).body.create_keyword('Fail', args=['expected'])
    path = tmp_path / 'output.xml'
    suite.run(output=str(path), log=None, report=None, console='none')
    history = {'version': 1, 'contexts': {'android': {'tests': {'id:a': [1, 2, 3, 4, 5]}}}}
    record(history, 'android', [str(path)])
    samples = history['contexts']['android']['tests']
    assert samples['id:a'][:4] == [2, 3, 4, 5] and samples['id:a'][-1] >= 0.1
    assert 'id:b' not in samples


def test_real_cloud_plan_preserves_selected_cases_and_suite_lifecycle(tmp_path):
    from robot.api import TestSuiteBuilder as Builder
    from JobFilter import JobFilter
    from selected_suites import identity, select

    e2e = Path(__file__).resolve().parents[1]
    suites = select(['--exclude', 'slow', '--exclude', 'needs-funded', '--exclude', 'excludefromci',
                     '--exclude', 'device-shell', *map(str, sorted((e2e / 'tests').glob('*.robot')))])
    selection = {str(s.source): [identity(t) for t in s.tests] for s in suites}
    original = {str(s.source): s for s in suites}
    planned = plan(selection, reuse=True)
    path = tmp_path / 'plan.json'
    path.write_text(json.dumps(planned))
    executed = Counter()
    for job in planned['jobs']:
        suite = Builder().build(*job['cases'])
        suite.visit(JobFilter(str(path), job['id']))
        for child in (suite.suites or [suite]):
            source = str(child.source)
            assert child.setup.name == original[source].setup.name
            assert child.teardown.name == original[source].teardown.name
            assert [identity(t) for t in child.tests] == job['cases'][source]
            executed.update(identity(t) for t in child.tests)
    assert executed == Counter(case for cases in selection.values() for case in cases)


def test_metrics_measure_job_wall_time_without_claiming_device_cost(tmp_path):
    from schedule import metrics

    planned = plan(manifest(card=1, settings=1))
    first = tmp_path / planned['jobs'][0]['id']
    first.mkdir()
    (first / 'wall-seconds').write_text('12')
    report = metrics(planned, tmp_path, elapsed=15)
    assert report['scheduler_wall_seconds'] == 15
    assert report['summed_job_seconds'] == 12
    assert report['jobs'][1]['wall_seconds'] is None
    assert 'not billed device minutes' in report['note']
