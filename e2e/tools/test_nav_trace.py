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


def test_ios_file_reader_returns_only_new_lines_and_survives_restart():
    import base64

    from NavTrace import NavTrace

    def lines(seqs):
        return "\n".join("[E2E-NAV] " + json.dumps({"event": "focus", "screen": "A", "t": s, "seq": s}) for s in seqs)

    class Driver:
        capabilities = {"platformName": "iOS", "bundleId": "b"}
        data = lines([1, 2, 3])

        def pull_file(self, _path):
            return base64.b64encode(self.data.encode())

    trace, driver = NavTrace(), Driver()
    assert len(trace._read_ios_file(driver)) == 3
    assert trace._read_ios_file(driver) == []
    driver.data = lines([1, 2, 3, 4])
    assert len(trace._read_ios_file(driver)) == 1
    driver.data = lines([1])
    assert len(trace._read_ios_file(driver)) == 1


if __name__ == "__main__":
    for name, case in sorted(globals().items()):
        if name.startswith("test_"):
            case()
            print(f"ok  {name}")
    print("all nav-trace checks pass")
