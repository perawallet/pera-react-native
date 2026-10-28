import os

from affected_flows import classify, include_expression, load_suites, render_markdown

SUITES = load_suites()


def test_every_suite_is_indexed_with_its_tag_and_scenarios():
    assert "accounts" in SUITES and SUITES["accounts"]["tag"] == "accounts"
    assert SUITES["cloud_backup"]["tag"] == "cloud-backup"
    assert SUITES["accounts"]["scenarios"] > 0
    assert "resources/app.resource" in SUITES["accounts"]["resources"]
    assert "account_selection_button" in SUITES["accounts"]["ids"]
    assert "account_switcher_row_" in SUITES["accounts"]["prefixes"]


def test_a_declared_test_id_selects_the_suites_that_locate_it(tmp_path):
    src = tmp_path / "apps/mobile/src/modules/search/components/Row.tsx"
    src.parent.mkdir(parents=True)
    src.write_text("<PWView testID='contacts_search_input' /><Row testID={`account_switcher_row_${a}`} />")
    selected, reasons, everything = classify(
        ["apps/mobile/src/modules/search/components/Row.tsx"], SUITES, repo_dir=str(tmp_path)
    )
    assert {"contacts", "accounts"} <= selected
    assert not everything
    assert any("contacts_search_input" in r for r in reasons["contacts"])


def test_a_module_path_selects_its_suites_without_a_test_id():
    selected, reasons, everything = classify(
        ["apps/mobile/src/modules/swap/hooks/useQuote.ts"], SUITES, repo_dir="/nonexistent"
    )
    assert selected == {"swap"} and reasons["swap"] == ["module swap"] and not everything


def test_a_suite_file_and_a_resource_select_their_suites():
    selected, _, _ = classify(["e2e/tests/stake.robot", "e2e/resources/send_receive.resource"], SUITES)
    assert selected == {"stake", "send_receive", "assets", "transactions"}


def test_shared_paths_select_everything():
    selected, _, everything = classify(["apps/mobile/src/routes/index.tsx"], SUITES)
    assert selected == set(SUITES) and everything == ["apps/mobile/src/routes/index.tsx"]


def test_docs_tests_and_the_browser_app_select_nothing():
    files = [
        "docs/TESTING.md",
        "apps/browser/src/x.ts",
        "apps/mobile/src/modules/swap/__tests__/useQuote.spec.ts",
        "apps/mobile/src/__integration__/swap.spec.tsx",
    ]
    selected, _, everything = classify(files, SUITES, repo_dir="/nonexistent")
    assert not selected and not everything


def test_repository_tooling_selects_nothing():
    files = ['.github/workflows/release-rc.yml', 'tools/release/tag.sh', 'CLAUDE.md',
             'apps/mobile/vitest.config.ts', 'apps/mobile/fastlane/Fastfile', '.oxlintrc.json']
    selected, _, everything = classify(files, SUITES, repo_dir='/nonexistent')
    assert not selected and not everything


def test_the_search_package_selects_the_add_asset_flow():
    selected, _, everything = classify(['packages/search/src/index.ts'], SUITES, repo_dir='/nonexistent')
    assert 'assets' in selected and not everything


def test_a_suite_browserstack_excludes_is_offered_as_local_only():
    text = render_markdown({"walletconnect"}, {"walletconnect": ["module dapp"]}, [], SUITES, 1)
    assert "include` =" not in text
    assert "Local device only" in text and "`walletconnect`" in text


def test_include_expression_uses_robot_tags():
    assert include_expression({"cloud_backup", "accounts"}, SUITES) == "accountsORcloud-backup"


def test_markdown_names_the_suites_and_the_include_tag():
    text = render_markdown({"swap"}, {"swap": ["module swap"]}, [], SUITES, 1)
    assert "`swap`" in text and "include` = `swap`" in text and "module swap" in text
    assert render_markdown(set(), {}, [], SUITES, 2).count("No e2e run needed") == 1
    assert "Every suite" in render_markdown(set(SUITES), {}, ["package.json"], SUITES, 1)


def test_unmapped_runtime_paths_conservatively_select_every_suite():
    for path in [
        'apps/mobile/src/hooks/useNewBehavior.ts',
        'apps/mobile/src/modules/new-module/hooks/useBehavior.ts',
        'packages/new-package/src/index.ts',
        'e2e/tools/selected_suites.py',
        'apps/mobile/shim.js',
        'apps/mobile/react-native.config.js',
        'apps/mobile/assets/fonts/DMSans-Regular.ttf',
        'apps/mobile/config/google-services.json',
        'apps/mobile/tsconfig.json',
        'turbo.json',
        'apps/mobile/src/modules/deeplink/hooks/useDeepLink.ts',
        'packages/accounts/src/store.ts',
    ]:
        selected, _, everything = classify([path], SUITES, repo_dir='/nonexistent')
        assert selected == set(SUITES), path
        assert everything == [path]


def test_deleted_and_renamed_ids_are_read_from_the_base_revision(tmp_path):
    import subprocess

    def git(*args):
        return subprocess.run(['git', *args], cwd=tmp_path, check=True, capture_output=True, text=True)

    git('init', '-q')
    path = 'apps/mobile/src/modules/search/Row.tsx'
    source = tmp_path / path
    source.parent.mkdir(parents=True)
    source.write_text("<Input testID='contacts_search_input' />")
    git('add', '.')
    git('-c', 'user.name=E2E', '-c', 'user.email=e2e@example.invalid',
        '-c', 'commit.gpgsign=false', 'commit', '-qm', 'base')
    for content in ("<Input testID='renamed_input' />", None):
        if content is None:
            source.unlink()
        else:
            source.write_text(content)
        selected, _, _ = classify([path], SUITES, repo_dir=str(tmp_path), base='HEAD')
        assert 'contacts' in selected


def test_a_renamed_file_lists_its_old_path_too(tmp_path):
    import subprocess
    from affected_flows import changed_files

    def git(*args):
        subprocess.run(['git', '-c', 'user.name=E2E', '-c', 'user.email=e2e@example.invalid',
                        '-c', 'commit.gpgsign=false', *args], cwd=tmp_path, check=True, capture_output=True)

    git('init', '-q')
    old = tmp_path / 'apps/mobile/src/modules/contacts/Row.tsx'
    old.parent.mkdir(parents=True)
    old.write_text("<Input testID='contacts_search_input' />\n" * 20)
    git('add', '.')
    git('commit', '-qm', 'base')
    git('tag', 'base')
    git('mv', 'apps/mobile/src/modules/contacts', 'apps/mobile/src/modules/swap')
    git('commit', '-qm', 'move')
    assert set(changed_files('base', repo_dir=str(tmp_path))) == {
        'apps/mobile/src/modules/contacts/Row.tsx', 'apps/mobile/src/modules/swap/Row.tsx'}
