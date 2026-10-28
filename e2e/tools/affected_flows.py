"""Which device e2e suites a change touches, and how to run them.

Usage:
  python e2e/tools/affected_flows.py [--base origin/main] [--files -] [--format md|json]

Reads the changed paths (git diff against --base, or one path per line from --files) and
maps them onto the suites in e2e/tests/ three ways, from the most exact to the coarsest:

1. A testID the changed source declares that a suite locates (`tid=` and prefix locators),
   so a renamed or removed id names the suites it breaks.
2. The app module or package the path belongs to (the tables below), for behaviour changes
   that keep their ids.
3. Paths every suite depends on (navigation, bootstrap, native projects, the harness itself),
   which select the whole suite.

Paths that reach no device flow (docs, the browser app, lint tooling) select nothing. The
CI pre-merge job posts the result on the pull request; locally it prints the run command.
"""

import argparse
import json
import os
import re
import subprocess
import sys

E2E_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_DIR = os.path.dirname(E2E_DIR)
MARKER = "<!-- e2e-affected-flows -->"

# Changes here can shift every screen: the whole suite runs.
EVERYTHING = (
    "apps/mobile/src/routes/",
    "apps/mobile/src/bootstrap/",
    "apps/mobile/src/providers/",
    "apps/mobile/src/layouts/",
    "apps/mobile/src/theme/",
    "apps/mobile/src/polyfills/",
    "apps/mobile/src/i18n/locales/en.json",
    "apps/mobile/src/App",
    "apps/mobile/src/useAppBootstrap",
    "apps/mobile/src/modules/bottom-sheet/",
    "apps/mobile/src/modules/prompts/",
    "apps/mobile/src/modules/migration/",
    # Every suite starts through onboarding, the PIN unlock and a fixture deeplink.
    "apps/mobile/src/modules/onboarding/",
    "apps/mobile/src/modules/security/",
    "apps/mobile/src/modules/deeplink/hooks/",
    "apps/mobile/src/modules/deeplink/handlers/index",
    "apps/mobile/src/modules/deeplink/core",
    "apps/mobile/src/modules/deeplink/parser",
    "apps/mobile/src/modules/deeplink/navigateToScreen",
    "apps/mobile/src/modules/deeplink/handlers/useE2eFixtureDeeplink",
    "apps/mobile/src/modules/deeplink/handlers/e2eNavTracer",
    "apps/mobile/src/modules/deeplink/dev-e2e-fixture-parser",
    "apps/mobile/android/",
    "apps/mobile/ios/",
    "apps/mobile/native-modules/",
    "apps/mobile/plugins/",
    "apps/mobile/app.config",
    "apps/mobile/app.json",
    "apps/mobile/metro",
    "apps/mobile/babel.config.js",
    "apps/mobile/package.json",
    "apps/mobile/index.js",
    "apps/mobile/shim.js",
    "apps/mobile/entry.native.js",
    "extensions/platform/",
    "extensions/platform-react-native/",
    "extensions/provider/",
    "packages/accounts/",
    "packages/security/",
    "packages/config/",
    "packages/shared/",
    "packages/chain-contract/",
    "packages/chain-algorand/",
    "packages/chain-shared/",
    "packages/database/",
    "packages/kms/",
    "packages/migrate/",
    "packages/remote-config/",
    "packages/polling/",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "turbo.json",
    ".npmrc",
    "patches/",
    "e2e/resources/app.resource",
    "e2e/resources/platforms/",
    "e2e/resources/libraries/",
    "e2e/tools/run.sh",
    "e2e/tools/browserstack.sh",
    "e2e/tools/selected_suites.py",
    "e2e/tools/verify_results.py",
    "e2e/tools/schedule.py",
    "e2e/tools/JobFilter.py",
    "e2e/requirements",
    "e2e/browserstack-",
    ".github/workflows/e2e-browserstack.yml",
    "tools/qa/",
    "ci/jobs/smoke.sh",
)

# apps/mobile/src/modules/<name>/ -> suites. A module absent here reaches suites only through
# the testIDs it declares.
MODULES = {
    "accounts": ["accounts", "persistence", "multisig", "rekey", "quantum", "assets", "transactions"],
    "age-gate": ["discover", "onramp", "stake", "swap"],
    "assets": ["assets", "deeplinks", "send_receive"],
    "backup": ["backup"],
    "banners": ["accounts", "backup"],
    "card": ["card"],
    "chain-ui": ["accounts", "assets", "send_receive"],
    "cloud-backup": ["cloud_backup"],
    "connections": ["settings", "walletconnect"],
    "contacts": ["contacts", "deeplinks"],
    "dapp": ["walletconnect"],
    "deeplink": ["deeplinks", "multisig", "walletconnect", "contacts", "card"],
    "discover": ["discover"],
    "ledger": ["onboarding", "rekey"],
    "menu": ["accounts", "contacts", "deeplinks", "stake", "settings"],
    "messages": ["transactions"],
    "multisig": ["multisig"],
    "network": ["settings", "send_receive", "assets"],
    "onramp": ["onramp"],
    "projects": ["stake"],
    "rekey": ["rekey", "multisig"],
    "search": ["assets", "deeplinks"],
    "settings": ["settings", "persistence", "cloud_backup", "discover", "stake", "onboarding"],
    "signing": ["send_receive", "swap", "assets", "walletconnect", "multisig", "rekey"],
    "staking": ["stake"],
    "swap": ["swap"],
    "token": ["assets"],
    "transactions": ["transactions", "send_receive"],
    "view-passphrase": ["accounts", "device", "quantum"],
    "walletconnect": ["walletconnect", "settings"],
    "webview": ["discover", "stake", "settings", "swap"],
}

# packages/<name>/ and extensions/<name>/ -> suites, for the logic under those modules.
PACKAGES = {
    "age-gate": ["discover", "onramp", "stake", "swap"],
    "arc0027": ["walletconnect"],
    "asa-inbox": ["transactions"],
    "assets": ["assets", "swap", "send_receive"],
    "backup": ["backup", "cloud_backup"],
    "banners": ["accounts", "backup"],
    "blockchain": ["send_receive", "transactions", "assets", "rekey"],
    "card": ["card"],
    "connections": ["settings", "walletconnect"],
    "contacts": ["contacts", "deeplinks"],
    "currencies": ["settings", "persistence", "swap"],
    "dapp": ["walletconnect"],
    "deeplinks": ["deeplinks", "multisig", "walletconnect"],
    "device": ["multisig"],
    "fee-delegation": ["send_receive", "assets"],
    "hardware-wallet": ["onboarding", "rekey"],
    "ledger": ["onboarding", "rekey"],
    "ledger-react-native": ["onboarding", "rekey"],
    "ledger-shared": ["onboarding", "rekey"],
    "messages": ["transactions"],
    "multisig": ["multisig", "rekey"],
    "nfd": ["send_receive", "contacts"],
    "onramp": ["onramp"],
    "passkeys": ["settings", "cloud_backup"],
    "projects": ["stake"],
    "search": ["assets", "deeplinks"],
    "settings": ["settings", "persistence"],
    "signing": ["send_receive", "swap", "assets", "walletconnect", "multisig", "rekey"],
    "staking": ["stake"],
    "swaps": ["swap"],
    "transactions": ["transactions", "send_receive"],
    "walletconnect": ["walletconnect", "settings"],
}

# Nothing under these reaches a device flow. Any other path that matches no rule runs every suite.
IGNORED = (
    "docs/",
    ".claude/",
    ".github/",
    ".bitrise/",
    ".vscode/",
    "ci/",
    "tools/",
    "README.md",
    "CLAUDE.md",
    "CONTRIBUTING.md",
    "CODEOWNERS",
    "LICENSE.txt",
    "lanekeep.config.ts",
    ".oxlintrc",
    ".oxfmtrc",
    ".fallowrc",
    ".gitleaks.toml",
    ".gitignore",
    ".tool-versions",
    "apps/mobile/__tests__/",
    "apps/mobile/__mocks__/",
    "apps/mobile/fastlane/",
    "apps/mobile/Gemfile",
    "apps/mobile/vitest",
    "apps/mobile/entry.web.js",
    "apps/mobile/README.md",
    "apps/mobile/CLAUDE.md",
    "apps/mobile/.oxlintrc.json",
    "apps/mobile/.gitignore",
    "apps/browser/",
    "apps/mobile/src/__integration__/",
    "apps/mobile/src/__tests__/",
    "apps/mobile/src/test-utils/",
    "apps/mobile/src/modules/settings/screens/developer/gallery-catalog/",
    "conformance/",
    "lanekeep/",
    "specs/",
    "e2e/README.md",
    "e2e/tools/affected_flows.py",
    "e2e/tools/test_",
    "e2e/tools/parity.py",
    "e2e/tools/flow_diff.py",
)

TEST_ID_RE = re.compile(r"""testID(?:Prefix)?[=:]\s*[{(]?\s*[`'"]([A-Za-z0-9_\-]+)""")
LOCATOR_RE = re.compile(r"tid=([A-Za-z0-9_\-]+)")
ATTR_RE = re.compile(r"@(?:resource-id|name|content-desc)='([A-Za-z0-9_\-]+)'")
PREFIX_RE = re.compile(r"starts-with\(@(?:resource-id|name|content-desc),\s*'([A-Za-z0-9_\-]+)'")
RESOURCE_RE = re.compile(r"^Resource\s+(\S+)", re.M)
TAGS_RE = re.compile(r"^Test Tags\s+(.+)$", re.M)
# browserstack.sh excludes these; a suite tagged with one runs on a local device only.
CLOUD_EXCLUDED = {"slow", "needs-funded", "excludefromci", "device-shell"}
CASE_TAGS_RE = re.compile(r"^\s+\[Tags\]\s+(.+)$", re.M)


def _read(path):
    with open(path, encoding="utf-8", errors="ignore") as f:
        return f.read()


def _is_test_file(path):
    return "__tests__" in path or "__integration__" in path or path.endswith(
        (".spec.ts", ".spec.tsx", ".test.ts", ".test.tsx")
    )


def load_suites(e2e_dir=E2E_DIR):
    """Every suite with its tag, the resources it reads and the testIDs it locates."""
    suites = {}
    tests_dir = os.path.join(e2e_dir, "tests")
    for name in sorted(os.listdir(tests_dir)):
        if not name.endswith(".robot"):
            continue
        suite = name[:-6]
        text = _read(os.path.join(tests_dir, name))
        found_tags = TAGS_RE.search(text)
        tags = found_tags.group(1).split() if found_tags else [suite]
        case_tags = [t.split() for t in CASE_TAGS_RE.findall(text)]
        resources = set()
        pending = [os.path.normpath(os.path.join(tests_dir, r)) for r in RESOURCE_RE.findall(text)]
        texts = [text]
        while pending:
            path = pending.pop()
            if path in resources or not os.path.exists(path):
                continue
            resources.add(path)
            body = _read(path)
            texts.append(body)
            base = os.path.dirname(path)
            pending += [os.path.normpath(os.path.join(base, r)) for r in RESOURCE_RE.findall(body)]
        ids, prefixes = set(), set()
        for body in texts:
            for found in LOCATOR_RE.findall(body) + ATTR_RE.findall(body):
                (prefixes if found.endswith(("_", "-")) else ids).add(found)
            prefixes.update(PREFIX_RE.findall(body))
        suites[suite] = {
            "tag": tags[0],
            "cloud": not CLOUD_EXCLUDED & set(tags),
            "resources": {os.path.relpath(r, e2e_dir).replace(os.sep, "/") for r in resources},
            "ids": ids,
            "prefixes": prefixes,
            "scenarios": sum(1 for t in case_tags if any(x.startswith("id:") for x in t)),
            "p0": sum(1 for t in case_tags if "p0" in t),
        }
    return suites


def declared_ids(path, repo_dir=REPO_DIR, base=None):
    full = os.path.join(repo_dir, path)
    if not path.endswith((".ts", ".tsx")):
        return set()
    ids = set(TEST_ID_RE.findall(_read(full))) if os.path.isfile(full) else set()
    if base:
        previous = subprocess.run(
            ["git", "show", f"{base}:{path}"], cwd=repo_dir,
            capture_output=True, text=True, check=False,
        )
        if previous.returncode == 0:
            ids.update(TEST_ID_RE.findall(previous.stdout))
    return ids


def _matching_suites(ids, suites):
    hits = {}
    for suite, info in suites.items():
        matched = {i for i in ids if i in info["ids"] or any(i.startswith(p) for p in info["prefixes"])}
        matched |= {i for i in ids if any(p.startswith(i) for p in info["prefixes"])}
        if matched:
            hits[suite] = matched
    return hits


def classify(files, suites, repo_dir=REPO_DIR, base=None):
    """Returns (selected, reasons, everything): the suites to run, why, and whether every suite is."""
    selected, reasons, everything = set(), {}, []

    def select(suite, why):
        if suite not in suites:
            return
        selected.add(suite)
        reasons.setdefault(suite, [])
        if why not in reasons[suite]:
            reasons[suite].append(why)

    for path in files:
        if _is_test_file(path):
            continue
        if any(path.startswith(p) for p in EVERYTHING):
            everything.append(path)
            continue
        if any(path.startswith(p) for p in IGNORED):
            continue
        if path.startswith("e2e/tests/") and path.endswith(".robot"):
            select(os.path.basename(path)[:-6], path)
            continue
        if path.startswith("e2e/resources/"):
            rel = path[len("e2e/"):]
            for suite, info in suites.items():
                if rel in info["resources"]:
                    select(suite, path)
            continue
        if path.startswith("e2e/"):
            continue
        parts = path.split("/")
        id_matches = _matching_suites(declared_ids(path, repo_dir, base), suites)
        for suite, matched in id_matches.items():
            select(suite, f"{path} declares {', '.join(sorted(matched))}")
        if path.startswith("apps/mobile/src/modules/") and len(parts) > 4:
            if parts[4] not in MODULES:
                everything.append(path)
            for suite in MODULES.get(parts[4], []):
                select(suite, f"module {parts[4]}")
        elif path.startswith(("packages/", "extensions/")) and len(parts) > 2:
            if parts[1] not in PACKAGES:
                everything.append(path)
            for suite in PACKAGES.get(parts[1], []):
                select(suite, f"{parts[0]}/{parts[1]}")
        elif path.startswith("apps/mobile/src/components/"):
            # A shared component with no testID a suite knows can still sit on every screen.
            if not id_matches:
                everything.append(path)
        else:
            everything.append(path)
    if everything:
        selected = set(suites)
    return selected, reasons, everything


def include_expression(selected, suites):
    return "OR".join(suites[s]["tag"] for s in sorted(selected))


def render_markdown(selected, reasons, everything, suites, files_count):
    lines = [MARKER, "## Device e2e flows affected"]
    if not selected:
        lines.append(f"None of the {files_count} changed files reaches a device flow. No e2e run needed.")
        return "\n".join(lines) + "\n"
    scenarios = sum(suites[s]["scenarios"] for s in selected)
    p0 = sum(suites[s]["p0"] for s in selected)
    if everything:
        lines.append(
            f"**Every suite** ({len(selected)} suites, {scenarios} scenarios, {p0} p0): "
            "a change under a path every screen depends on."
        )
        lines += [""] + [f"- `{p}`" for p in sorted(set(everything))[:15]]
        if len(set(everything)) > 15:
            lines.append(f"- and {len(set(everything)) - 15} more")
        include = ""
    else:
        names = ", ".join(f"`{s}`" for s in sorted(selected))
        lines.append(f"**{len(selected)} suite{'s' if len(selected) != 1 else ''}** ({scenarios} scenarios, {p0} p0): {names}")
        lines += ["", "| Suite | Why |", "|---|---|"]
        for suite in sorted(selected):
            why = "<br>".join(reasons.get(suite, []))
            lines.append(f"| `{suite}` | {why} |")
        include = include_expression(selected, suites)
    lines += ["", "Run them:"]
    if include:
        cloud = {s for s in selected if suites[s]["cloud"]}
        if cloud:
            lines.append(f"- BrowserStack: the `E2E / BrowserStack` workflow with `include` = "
                         f"`{include_expression(cloud, suites)}`")
        if cloud != selected:
            local = ", ".join(f"`{s}`" for s in sorted(selected - cloud))
            lines.append(f"- Local device only (BrowserStack excludes them): {local}")
        lines.append(f"- A device: `e2e/tools/run.sh <android|ios> --include {include}`")
    else:
        lines.append("- BrowserStack: the `E2E / BrowserStack` workflow with `include` left empty")
        lines.append("- A device: `e2e/tools/run.sh <android|ios>`")
    return "\n".join(lines) + "\n"


def changed_files(base, repo_dir=REPO_DIR):
    out = subprocess.run(
        # A rename must list its old path too, so the old module and ids are still mapped.
        ["git", "diff", "--name-only", "--no-renames", "--merge-base", base, "HEAD"],
        cwd=repo_dir, capture_output=True, text=True, check=True,
    ).stdout
    return [line.strip() for line in out.splitlines() if line.strip()]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--base", help="base git ref; also reads removed/renamed testIDs from this ref")
    parser.add_argument("--files", help="file with one changed path per line, or - for stdin")
    parser.add_argument("--format", choices=["md", "json"], default="md")
    args = parser.parse_args(argv)

    if args.files:
        source = sys.stdin if args.files == "-" else open(args.files)
        files = [line.strip() for line in source if line.strip()]
    else:
        files = changed_files(args.base or "origin/main")
    suites = load_suites()
    selected, reasons, everything = classify(
        files, suites, base=args.base or (None if args.files else "origin/main")
    )
    if args.format == "json":
        print(json.dumps({
            "suites": sorted(selected),
            "include": "" if everything else include_expression(selected, suites),
            "everything": sorted(set(everything)),
            "reasons": {s: reasons.get(s, []) for s in sorted(selected)},
        }, indent=1))
    else:
        print(render_markdown(selected, reasons, everything, suites, len(files)), end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
