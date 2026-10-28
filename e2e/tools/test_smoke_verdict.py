import subprocess
from pathlib import Path


VERDICT = Path(__file__).resolve().parents[2] / 'tools/qa/smoke-verdict.sh'


def test_incomplete_cloud_run_cannot_pass_with_partial_results(tmp_path):
    (tmp_path / 'output.xml').write_text('<robot><statistics><total><stat pass="1" fail="0" skip="0">All Tests</stat></total></statistics></robot>')
    complete = subprocess.run([str(VERDICT), str(tmp_path)], capture_output=True, text=True)
    assert complete.returncode == 0 and complete.stdout.strip() == 'ok'
    (tmp_path / '.incomplete').touch()
    incomplete = subprocess.run([str(VERDICT), str(tmp_path)], capture_output=True, text=True)
    assert incomplete.returncode == 1 and incomplete.stdout.strip() == 'fail'


def test_failed_truncated_or_invalid_totals_cannot_pass(tmp_path):
    for xml in [
        '<robot><statistics><total><stat pass="1" fail="1" skip="0">All Tests</stat></total></statistics></robot>',
        '<robot><statistics><total><stat pass="1" fail="0" skip="0"/></total></statistics>',
        '<robot><statistics><total><stat pass="1" skip="0"/></total></statistics></robot>',
        '<robot><statistics><total><stat pass="1" fail="-1" skip="0"/></total></statistics></robot>',
    ]:
        (tmp_path / 'output.xml').write_text(xml)
        result = subprocess.run([str(VERDICT), str(tmp_path)], capture_output=True, text=True)
        assert result.returncode == 1 and result.stdout.strip() == 'fail'
