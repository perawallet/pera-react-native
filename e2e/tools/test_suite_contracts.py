"""Keep new scenarios independently runnable and identifiable on both platforms."""
from pathlib import Path
import re

from robot.api import TestSuiteBuilder as SuiteBuilder

from affected_flows import MODULES, PACKAGES, load_suites


E2E = Path(__file__).resolve().parents[1]


def test_every_scenario_has_a_unique_id_priority_and_cleanup():
    root = SuiteBuilder().build(str(E2E / 'tests'))
    seen = set()
    for suite in root.suites:
        assert suite.setup.name, f'{suite.name} needs a session setup'
        assert suite.teardown.name, f'{suite.name} needs a session teardown'
        assert len(suite.tests) > 0
        for test in suite.tests:
            ids = [tag for tag in test.tags if tag.startswith('id:')]
            assert len(ids) == 1, test.longname
            assert re.fullmatch(r'id:[a-z0-9_-]+(?:\.[a-z0-9_-]+)+', ids[0]), test.longname
            assert ids[0] not in seen, f'Duplicate {ids[0]}'
            seen.add(ids[0])
            assert len(set(test.tags) & {'p0', 'p1', 'p2'}) == 1, test.longname
            entry = [getattr(step, 'name', '') or '' for step in test.body[:3]]
            assert test.setup.name or any(name.startswith(('Start ', 'Open ', 'Import ')) for name in entry), (
                f'{test.longname} needs an independent starting state'
            )
            assert test.teardown.name, f'{test.longname} needs failure diagnostics'
            assert test.timeout, f'{test.longname} needs a timeout'
            if 'release-gate' in test.tags:
                assert 'p0' in test.tags
                assert not (set(test.tags) & {'slow', 'needs-funded', 'excludefromci', 'device-shell'})


def test_affected_flow_tables_reference_existing_suites():
    suites = load_suites()
    for mapping in (MODULES, PACKAGES):
        for name, selected in mapping.items():
            assert set(selected) <= suites.keys(), name
