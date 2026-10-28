"""Keep exactly the planned scenarios, including when Pabot rebuilds the suite."""

import json
from pathlib import Path

from robot.api import SuiteVisitor


class JobFilter(SuiteVisitor):
    def __init__(self, plan_path, job_id):
        plan = json.loads(Path(plan_path).read_text())
        job = next(j for j in plan['jobs'] if j['id'] == job_id)
        self.reuse = job['reuse_session']
        self.cases = {str(Path(source).resolve()): set(cases) for source, cases in job['cases'].items()}

    def start_suite(self, suite):
        if suite.parent is None and self.reuse:
            # A real Robot teardown makes a failed quit fail the run. Listener errors alone
            # are only logged by Robot and must never be the sole cleanup gate.
            suite.resource.imports.resource(str(Path(__file__).resolve().parents[1] / 'resources/app.resource'))
            suite.teardown.config(name='Close All Applications')
        allowed = self.cases.get(str(Path(suite.source).resolve()), set()) if suite.source else set()
        suite.tests = [test for test in suite.tests if
                       next((tag for tag in test.tags if tag.startswith('id:')), test.name) in allowed]

    def end_suite(self, suite):
        suite.suites = [child for child in suite.suites if child.test_count]
