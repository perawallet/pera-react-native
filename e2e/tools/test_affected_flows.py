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


def test_include_expression_uses_robot_tags():
    assert include_expression({"cloud_backup", "accounts"}, SUITES) == "accountsORcloud-backup"


def test_markdown_names_the_suites_and_the_include_tag():
    text = render_markdown({"swap"}, {"swap": ["module swap"]}, [], SUITES, 1)
    assert "`swap`" in text and "include` = `swap`" in text and "module swap" in text
    assert render_markdown(set(), {}, [], SUITES, 2).count("No e2e run needed") == 1
    assert "Every suite" in render_markdown(set(SUITES), {}, ["package.json"], SUITES, 1)
