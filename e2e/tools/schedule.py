"""Plan bounded cloud jobs; timings influence placement, never scenario selection."""

import argparse
from collections import Counter
import json
import math
from pathlib import Path
import statistics

from robot.api import ExecutionResult, ResultVisitor

from selected_suites import identity

# These suites preserve the wallet and end each case through its own home/fixture entry.
# Security, settings, backup, imports and account creation deliberately never share sessions.
WARM_SUITES = frozenset({'assets', 'card', 'discover', 'onramp', 'send_receive', 'transactions'})
SPLIT_SUITES = frozenset({'multisig', 'swap'})
DEFAULT_TEST_SECONDS = 45
DEFAULT_SETUP_SECONDS = 90


def positive(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0


def load_history(path):
    try:
        data = json.loads(Path(path).read_text())
        if not isinstance(data, dict) or data.get('version') != 1 or not isinstance(data.get('contexts'), dict):
            return {'version': 1, 'contexts': {}}
        contexts = {}
        for name, context in data['contexts'].items():
            if isinstance(context, dict):
                contexts[name] = {kind: values for kind in ('tests', 'suites')
                                  if isinstance(values := context.get(kind), dict)}
        return {'version': 1, 'contexts': contexts}
    except (OSError, ValueError):
        return {'version': 1, 'contexts': {}}


def estimate(samples, fallback):
    clean = [s for s in samples if positive(s)] if isinstance(samples, list) else []
    return statistics.median(clean) if clean else fallback


def plan(manifest, history=None, context='default', budget=900, reuse=False, workers=2):
    if not positive(budget) or budget > 1800:
        raise ValueError('Job budget must be greater than zero and at most 1800 seconds')
    if not isinstance(workers, int) or workers < 1:
        raise ValueError('Worker count must be positive')
    records = (history or {}).get('contexts', {}).get(context, {})
    timings = records.get('tests', {})
    setups = records.get('suites', {})
    identities = [case for cases in manifest.values() for case in cases]
    if not identities or any(n > 1 for n in Counter(identities).values()):
        raise ValueError('Selection must contain unique scenario identities')
    units = []
    for source, cases in sorted(manifest.items()):
        name = Path(source).stem
        overhead = estimate(setups.get(name), DEFAULT_SETUP_SECONDS)
        chunks, chunk, seconds = [], [], overhead
        for case in cases:
            cost = estimate(timings.get(case), DEFAULT_TEST_SECONDS)
            if chunk and name in SPLIT_SUITES and seconds + cost > budget:
                chunks.append((chunk, seconds))
                chunk, seconds = [], overhead
            chunk.append(case)
            seconds += cost
        if chunk:
            chunks.append((chunk, seconds))
        for cases, seconds in chunks:
            units.append({'cases': {source: cases}, 'estimated_seconds': seconds,
                          'reuse_session': bool(reuse and name in WARM_SUITES)})
    # Best-fit decreasing packs warm suites without reordering tests inside a suite.
    jobs = []
    for unit in sorted(units, key=lambda u: (-u['estimated_seconds'], sorted(u['cases']))):
        fitting = [j for j in jobs if j['reuse_session'] and unit['reuse_session']
                   and j['estimated_seconds'] + unit['estimated_seconds'] <= budget]
        if fitting:
            target = max(fitting, key=lambda j: j['estimated_seconds'])
            target['cases'].update(unit['cases'])
            target['estimated_seconds'] += unit['estimated_seconds']
        else:
            jobs.append(unit)
    jobs.sort(key=lambda j: (-j['estimated_seconds'], sorted(j['cases'])))
    loads = [0.0] * workers
    for index, job in enumerate(jobs):
        job['id'] = f'job-{index + 1:03d}'
        job['reuse_session'] = job['reuse_session'] and len(job['cases']) > 1
        job['estimated_seconds'] = round(job['estimated_seconds'], 2)
        job['exceeds_budget'] = job['estimated_seconds'] > budget
        lane = min(range(workers), key=lambda i: loads[i])
        loads[lane] += job['estimated_seconds']
    selected = Counter(identities)
    scheduled = Counter(case for job in jobs for cases in job['cases'].values() for case in cases)
    if scheduled != selected:
        raise ValueError('Planner changed scenario coverage')
    return {'version': 1, 'context': context, 'jobs': jobs, 'scenario_count': len(identities),
            'measured_scenarios': sum(bool([s for s in timings.get(case, []) if positive(s)])
                                      for case in identities if isinstance(timings.get(case, []), list)),
            'estimated_worker_seconds': loads, 'budget_seconds': budget,
            'note': 'Estimates only; unmeasured tests use conservative defaults. Oversized isolated suites stay intact.'}


class Timings(ResultVisitor):
    def __init__(self):
        self.tests, self.suites = {}, {}

    def visit_test(self, test):
        seconds = test.elapsed_time.total_seconds()
        # Failed/time-out/skip and near-zero samples distort scheduling.
        # An absent setup or teardown still reports FAIL; only a real one counts.
        fixtures = [k for k in (test.parent.setup, test.parent.teardown) if k]
        if test.status == 'PASS' and seconds >= 0.1 and not any(k.failed for k in fixtures):
            self.tests[identity(test)] = seconds

    def start_suite(self, suite):
        seconds = suite.setup.elapsed_time.total_seconds() + suite.teardown.elapsed_time.total_seconds()
        if suite.tests and suite.status == 'PASS' and seconds >= 0.1:
            self.suites[Path(str(suite.source)).stem] = seconds


def record(history, context, outputs):
    collector = Timings()
    for path in outputs:
        ExecutionResult(path).visit(collector)
    target = history.setdefault('contexts', {}).setdefault(context, {})
    for kind, samples in [('tests', collector.tests), ('suites', collector.suites)]:
        store = target.setdefault(kind, {})
        for name, value in samples.items():
            previous = store.get(name, [])
            store[name] = ([s for s in previous if positive(s)][-4:] if isinstance(previous, list) else []) + [value]
    return history


def metrics(planned, directory, elapsed):
    jobs = []
    for job in planned['jobs']:
        try:
            seconds = int((Path(directory) / job['id'] / 'wall-seconds').read_text())
        except (OSError, ValueError):
            seconds = None
        jobs.append({'id': job['id'], 'wall_seconds': seconds,
                     'estimated_seconds': job['estimated_seconds'], 'reuse_session': job['reuse_session']})
    return {'scenario_count': planned['scenario_count'], 'sdk_process_count': len(jobs),
            'scheduler_wall_seconds': elapsed,
            'summed_job_seconds': sum(job['wall_seconds'] or 0 for job in jobs), 'jobs': jobs,
            'note': 'SDK job wall times include allocation and startup; they are not billed device minutes.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    build = commands.add_parser('plan')
    build.add_argument('manifest')
    build.add_argument('--history', required=True)
    build.add_argument('--context', required=True)
    build.add_argument('--budget', type=float, default=900)
    build.add_argument('--workers', type=int, default=2)
    build.add_argument('--reuse', action='store_true')
    build.add_argument('--output', required=True)
    build.add_argument('--jobs-dir')
    update = commands.add_parser('record')
    update.add_argument('--history', required=True)
    update.add_argument('--context', required=True)
    update.add_argument('outputs', nargs='+')
    show = commands.add_parser('show')
    show.add_argument('plan_path')
    report = commands.add_parser('report')
    report.add_argument('plan_path')
    report.add_argument('directory')
    report.add_argument('--elapsed', type=int, required=True)
    args = parser.parse_args()
    if args.command == 'report':
        planned = json.loads(Path(args.plan_path).read_text())
        result = metrics(planned, args.directory, args.elapsed)
        destination = Path(args.directory)
        (destination / 'run-metrics.json').write_text(json.dumps(result, indent=2))
        lines = ['## E2E scheduling',
                 f"{result['scenario_count']} scenarios, {result['sdk_process_count']} SDK jobs, "
                 f"{args.elapsed}s wall time.", '', '| Job | Estimated seconds | Actual SDK seconds | Warm |',
                 '|---|---:|---:|---|']
        lines += [f"| {j['id']} | {j['estimated_seconds']} | {j['wall_seconds']} | {j['reuse_session']} |" for j in result['jobs']]
        (destination / 'run-metrics.md').write_text('\n'.join(lines) + '\n\n' + result['note'] + '\n')
        return
    if args.command == 'show':
        result = json.loads(Path(args.plan_path).read_text())
        print(f"{result['scenario_count']} scenarios in {len(result['jobs'])} jobs; "
              f"{result['measured_scenarios']} scenarios have measured timing samples")
        for job in result['jobs']:
            names = ', '.join(Path(source).stem for source in job['cases'])
            count = sum(len(cases) for cases in job['cases'].values())
            mode = 'warm' if job['reuse_session'] else 'isolated'
            if job['exceeds_budget']:
                mode += '*'
            print(f"{job['id']}  {job['estimated_seconds'] / 60:5.1f}m estimated  {mode:8}  {count:3} cases  {names}")
        print(result['note'])
        return
    history = load_history(args.history)
    if args.command == 'plan':
        result = plan(json.loads(Path(args.manifest).read_text()), history, args.context,
                      args.budget, args.reuse, args.workers)
        Path(args.output).write_text(json.dumps(result, indent=2))
        if args.jobs_dir:
            directory = Path(args.jobs_dir)
            directory.mkdir(parents=True, exist_ok=True)
            for job in result['jobs']:
                options = [f'--prerunmodifier {Path(__file__).with_name("JobFilter.py")}:{Path(args.output).resolve()}:{job["id"]}']
                if job['reuse_session']:
                    options += ['--variable E2E_REUSE_SESSION:True',
                                f'--listener {Path(__file__).resolve().parents[1] / "resources/libraries/WarmSession.py"}']
                else:
                    options += ['--variable E2E_REUSE_SESSION:False']
                (directory / f'{job["id"]}.args').write_text('\n'.join(options) + '\n')
                # Pabot rejects data sources inside an argument file; they go on the command line.
                (directory / f'{job["id"]}.suites').write_text('\n'.join(job['cases']) + '\n')
                (directory / f'{job["id"]}.reuse').write_text('1' if job['reuse_session'] else '0')
        for job in result['jobs']:
            print(job['id'])
    else:
        result = record(history, args.context, args.outputs)
        destination = Path(args.history)
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix('.tmp')
        temporary.write_text(json.dumps(result, indent=2))
        temporary.replace(destination)


if __name__ == '__main__':
    main()
