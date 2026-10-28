"""Select suite files with Robot's own tag/test/suite filtering before cloud sessions start."""

import sys
import json

from robot.api import TestSuiteBuilder
from robot.conf import RobotSettings
from robot.run import RobotFramework


def select(arguments):
    options, paths = RobotFramework().parse_arguments(arguments)
    suite = TestSuiteBuilder().build(*paths)
    suite.configure(**RobotSettings(options).suite_config)
    # A single input file is the root itself; multiple files have a synthetic parent.
    return [s for s in (suite.suites or [suite]) if s.test_count]


def identity(test):
    return next((tag for tag in test.tags if tag.startswith("id:")), test.name)


def selected_suites(arguments):
    return [str(s.source) for s in select(arguments)]


if __name__ == "__main__":
    arguments = sys.argv[1:]
    manifest = None
    if arguments[:1] == ["--manifest"]:
        manifest, arguments = arguments[1], arguments[2:]
    suites = select(arguments)
    if manifest:
        with open(manifest, "w", encoding="utf-8") as f:
            json.dump({str(s.source): [identity(t) for t in s.tests] for s in suites}, f, indent=2)
    print("\n".join(str(s.source) for s in suites))
