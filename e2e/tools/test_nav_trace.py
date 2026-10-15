import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "resources" / "libraries"))

from flow_diff import diff  # noqa: E402
from NavTrace import flow, parse, red_flags  # noqa: E402


def event(name, screen, t):
    return 'ReactNativeJS: [E2E-NAV] ' + json.dumps({"event": name, "screen": screen, "t": t})


def test_flags_double_open_leak_and_bounce():
    events = parse([
        "unrelated line",
        event("focus", "TabBar/Home", 0),
        event("focus", "Contacts/ContactsList", 100),
        event("focus", "TabBar/Home", 200),
        event("double-open", "Contacts/ViewContact", 300),
        '[E2E-NAV] {"event": "snapshot", "label": "fixture:home", "screens": ["TabBar", "Contacts"], "t": 400}',
    ])
    assert flow(events) == ["TabBar/Home", "Contacts/ContactsList", "TabBar/Home"]
    flags = red_flags(events)
    assert any(f.startswith("double-open") for f in flags)
    assert any(f.startswith("leak after fixture:home: Contacts") for f in flags)
    assert any(f.startswith("bounce") for f in flags)


def test_diff_reports_platform_divergence():
    same = {"flow": ["A", "B"], "flags": [], "status": "PASS"}
    other = {"flow": ["A", "C"], "flags": [], "status": "PASS"}
    assert diff({"x": same}, {"x": same}) == []
    assert diff({"x": same}, {"x": other})[0][1].startswith("flow differs")


def test_leak_check_allows_each_fixtures_own_landing():
    landing = {"event": "snapshot", "label": "fixture:contacts-one", "t": 1,
               "screens": ["TabBar", "TabBar/Home", "Contacts", "Contacts/ContactsList"]}
    deeper = dict(landing, screens=["TabBar", "Contacts", "Contacts/ViewContact"])
    assert red_flags([landing]) == []
    assert red_flags([deeper])
