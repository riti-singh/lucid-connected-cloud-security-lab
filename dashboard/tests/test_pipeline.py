import copy
import io
import json
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

DASHBOARD = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DASHBOARD))

import build_data  # noqa: E402

ROOT = build_data.ROOT
RECORDED = json.loads((ROOT / 'data/remediations.json').read_text())
SOURCE_FINDINGS = json.loads((ROOT / 'data/findings.json').read_text())


class FakeResponse:
    def __init__(self, payload, headers=None):
        self._body = json.dumps(payload).encode()
        self.headers = headers or {'X-RateLimit-Remaining': '42'}

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def http_error(url, code, message, headers):
    return urllib.error.HTTPError(url, code, message, headers, io.BytesIO(json.dumps({'message': message}).encode()))


def live_pulls(merged_numbers=()):
    pulls = []
    for pr in RECORDED['pull_requests'] + [{'number': 99, 'recorded_state': 'open', 'title': 'not curated',
                                            'created_at': '2026-10-16T18:00:00Z', 'merged_at': None}]:
        merged = pr['recorded_state'] == 'merged' or pr['number'] in merged_numbers
        pulls.append({
            'number': pr['number'], 'title': pr['title'], 'state': 'closed' if merged else 'open',
            'draft': False, 'created_at': pr['created_at'],
            'merged_at': (pr['merged_at'] or '2026-10-16T18:30:00Z') if merged else None,
            'closed_at': (pr['merged_at'] or '2026-10-16T18:30:00Z') if merged else None,
            'updated_at': '2026-10-16T18:30:00Z', 'head': {'sha': f"{pr['number']:040d}"},
            'html_url': f"{build_data.REPO_URL}/pull/{pr['number']}",
            'requested_reviewers': [{'login': 'riti-singh'}], 'requested_teams': [],
        })
    return pulls


def router(merged_numbers=(), check_runs_error=None, calls=None):
    def urlopen(req, timeout=None):
        url = req.full_url
        if calls is not None:
            calls.append(url)
        assert timeout == build_data.TIMEOUT
        assert req.get_header('Accept') == 'application/vnd.github+json'
        if '/pulls?' in url:
            return FakeResponse(live_pulls(merged_numbers))
        if '/check-runs' in url:
            if check_runs_error:
                raise check_runs_error(url)
            return FakeResponse({'total_count': 1, 'check_runs': [{
                'name': 'validate', 'status': 'completed', 'conclusion': 'success',
                'html_url': 'https://github.com/x/runs/1', 'completed_at': '2026-10-16T18:00:00Z'}]})
        if '/lab-validation.yml/runs' in url:
            return FakeResponse({'workflow_runs': [{
                'name': 'lab-validation', 'status': 'completed', 'conclusion': 'success',
                'html_url': 'https://github.com/x/actions/runs/2', 'head_sha': 'a' * 40, 'event': 'push',
                'created_at': '2026-10-16T18:05:00Z'}]})
        if '/deploy-dashboard.yml/runs' in url:
            raise http_error(url, 404, 'Not Found', {})
        raise AssertionError(f'unexpected URL {url}')
    return urlopen


def by_number(data):
    return {r['number']: r for r in data['remediations']}


def by_ticket(data):
    return {f['ticket']: f for f in data['findings']}


class NormalizationAndClassification(unittest.TestCase):
    def test_cwe_normalized_to_list(self):
        self.assertEqual(build_data.normalize_cwe('CWE-22'), ['CWE-22'])
        self.assertEqual(build_data.normalize_cwe(['CWE-1286', 'CWE-601']), ['CWE-1286', 'CWE-601'])

    def test_intake_group_never_verified(self):
        reproduced = {'ticket': 'LAB-501', 'verification_status': 'reproduced_by_expected_failing_test'}
        self.assertEqual(build_data.classify_group('intake-unclassified', [reproduced]), ('untriaged-intake', False))

    def test_code_group_verified_only_if_all_reproduced(self):
        ok = {'ticket': 'LAB-101', 'verification_status': 'reproduced_by_expected_failing_test'}
        pending = {'ticket': 'LAB-102', 'verification_status': 'unverified_pending_triage'}
        self.assertEqual(build_data.classify_group('shared-root-path-validation', [ok]), ('code-root-cause', True))
        self.assertEqual(build_data.classify_group('shared-root-path-validation', [ok, pending]), ('code-root-cause', False))
        self.assertEqual(build_data.classify_group('dependency-express', [{'ticket': 'DEP-201', 'verification_status': 'x'}]),
                         ('dependency-advisory', False))

    def test_finding_kind(self):
        self.assertEqual([build_data.finding_kind(t) for t in ('LAB-101', 'LAB-401', 'LAB-503', 'DEP-301')],
                         ['code', 'code', 'intake', 'dependency'])

    def test_triage_disagreement_fails(self):
        line = 'shared-root-path-validation: LAB-101, LAB-102; source=synthetic-static-review; group requires code review'
        with self.assertRaises(build_data.BuildError):
            build_data.build_groups(build_data.parse_triage(line), SOURCE_FINDINGS, [])

    def test_parse_baselines_error_and_mismatch(self):
        jobs, summary = build_data.parse_baselines(
            'Python: PASS; expected FAIL; MISMATCH\nsome test output: here\n'
            "ERROR TypeScript compile: required toolchain not found on PATH: tsc\n"
            "ERROR TypeScript tests: prerequisite 'TypeScript compile' did not run\n"
            'ERROR 2 job(s) could not run; results are not a valid baseline\n')
        self.assertEqual([(j['name'], j['result'], j['match']) for j in jobs],
                         [('Python', 'PASS', False), ('TypeScript compile', 'ERROR', False), ('TypeScript tests', 'ERROR', False)])
        self.assertEqual(summary, 'ERROR 2 job(s) could not run; results are not a valid baseline')


class RecordedBuild(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = build_data.build(use_github=False)

    def test_groups(self):
        groups = {g['id']: g for g in self.data['root_cause_groups']}
        self.assertEqual(groups['intake-unclassified']['classification'], 'untriaged-intake')
        self.assertFalse(groups['intake-unclassified']['verified'])
        self.assertEqual(groups['intake-unclassified']['finding_ids'], ['LAB-501', 'LAB-502', 'LAB-503', 'LAB-504'])
        self.assertTrue(groups['shared-root-path-validation']['verified'])
        for g in groups.values():
            self.assertEqual(g['triage_line'].split(':')[0], g['id'])
        for t in ('LAB-501', 'LAB-502', 'LAB-503', 'LAB-504'):
            self.assertEqual(by_ticket(self.data)[t]['triage_state'], 'untriaged')

    def test_pr8_blocked_on_owner_assignment(self):
        pr8 = by_number(self.data)[8]
        self.assertEqual(pr8['review_state'], 'blocked-owner-assignment')
        self.assertIn('telemetry-exporter', pr8['blocked_reason'])
        self.assertEqual(by_ticket(self.data)['LAB-401']['status'], 'fix-blocked')
        self.assertFalse(by_ticket(self.data)['LAB-401']['owner_assigned'])

    def test_github_skipped(self):
        self.assertEqual(self.data['sources']['github']['status'], 'skipped')
        self.assertTrue(all(r['state_source'] == 'recorded' and r['github'] is None for r in self.data['remediations']))


class GitHubEnrichment(unittest.TestCase):
    def test_unavailable_falls_back_to_recorded(self):
        def offline(req, timeout=None):
            raise urllib.error.URLError('network unreachable')
        with mock.patch('build_data.urllib.request.urlopen', offline):
            data = build_data.build(use_github=True)
        gh = data['sources']['github']
        self.assertEqual(gh['status'], 'unavailable')
        self.assertIn('network unreachable', gh['error'])
        for r in data['remediations']:
            self.assertEqual((r['state'], r['state_source'], r['github']), (r['recorded_state'], 'recorded', None))
        self.assertIsNone(data['ci']['lab_validation_main'])
        self.assertEqual(by_number(data)[8]['review_state'], 'blocked-owner-assignment')

    def test_merged_on_github_overrides_recorded_open(self):
        self.assertEqual(next(p for p in RECORDED['pull_requests'] if p['number'] == 1)['recorded_state'], 'open')
        with mock.patch('build_data.urllib.request.urlopen', router(merged_numbers={1})):
            data = build_data.build(use_github=True, token='test-token')
        gh = data['sources']['github']
        self.assertEqual((gh['status'], gh['authenticated'], gh['rate_limit_remaining']), ('ok', True, 42))
        pr1 = by_number(data)[1]
        self.assertEqual((pr1['state'], pr1['state_source'], pr1['review_state'], pr1['recorded_state']),
                         ('merged', 'github', 'merged', 'open'))
        self.assertEqual(pr1['github']['checks_conclusion'], 'success')
        self.assertEqual(by_ticket(data)['LAB-201']['status'], 'fix-merged')
        self.assertEqual(by_number(data)[8]['review_state'], 'blocked-owner-assignment')
        self.assertNotIn(99, by_number(data))
        self.assertEqual(data['ci']['lab_validation_main']['conclusion'], 'success')
        self.assertIsNone(data['ci']['deploy_dashboard_main'])
        self.assertIn('pr-merged', [e['type'] for e in data['history'] if e['ref'] == '#1'])
        self.assertNotIn('test-token', json.dumps(data))

    def test_rate_limited_before_any_data(self):
        def limited(req, timeout=None):
            raise http_error(req.full_url, 403, 'API rate limit exceeded',
                             {'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '1792200000'})
        with mock.patch('build_data.urllib.request.urlopen', limited):
            data = build_data.build(use_github=True)
        gh = data['sources']['github']
        self.assertEqual((gh['status'], gh['authenticated'], gh['rate_limit_remaining']), ('unavailable', False, 0))
        self.assertIn('rate limit', gh['error'])
        self.assertIn('resets at 2026-10-17T01:20:00Z', gh['error'])
        self.assertTrue(all(r['state_source'] == 'recorded' for r in data['remediations']))

    def test_rate_limited_mid_build_is_partial(self):
        calls = []
        err = lambda url: http_error(url, 429, 'Too Many Requests', {'X-RateLimit-Remaining': '0', 'Retry-After': '60'})
        with mock.patch('build_data.urllib.request.urlopen', router(check_runs_error=err, calls=calls)):
            data = build_data.build(use_github=True)
        gh = data['sources']['github']
        self.assertEqual(gh['status'], 'partial')
        self.assertIn('rate limit', gh['error'])
        self.assertEqual(sum('/check-runs' in c for c in calls), 1)
        self.assertFalse(any('/actions/' in c for c in calls))
        self.assertTrue(all(r['state_source'] == 'github' for r in data['remediations']))
        self.assertEqual(by_number(data)[1]['github']['checks_conclusion'], 'unknown')


class ValidateData(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import validate_data
        cls.v = validate_data
        cls.data = build_data.build(use_github=False)

    def rejected(self, data):
        if self.v.schema_errors(data):
            return True
        try:
            self.v.semantic_checks(data, SOURCE_FINDINGS)
        except AssertionError:
            return True
        return False

    def mutate(self, fn):
        data = copy.deepcopy(self.data)
        fn(data)
        return data

    def test_built_and_fixture_payloads_pass(self):
        self.assertEqual(self.v.schema_errors(self.data), [])
        self.v.semantic_checks(self.data, SOURCE_FINDINGS)
        fixture = json.loads((DASHBOARD / 'fixtures/data.fixture.json').read_text())
        self.assertEqual(self.v.schema_errors(fixture), [])
        self.v.semantic_checks(fixture, SOURCE_FINDINGS)

    def test_rejects_intake_in_verified_group(self):
        def add_intake(d):
            g = next(g for g in d['root_cause_groups'] if g['id'] == 'shared-root-path-validation')
            g['finding_ids'].append('LAB-504')
        self.assertTrue(self.rejected(self.mutate(add_intake)))
        def verify_intake(d):
            next(g for g in d['root_cause_groups'] if g['id'] == 'intake-unclassified')['verified'] = True
        self.assertTrue(self.rejected(self.mutate(verify_intake)))

    def test_rejects_lab_advisory_id(self):
        def add_advisory(d):
            by_ticket(d)['LAB-101']['advisory_id'] = 'CVE-2020-14343'
        self.assertTrue(self.rejected(self.mutate(add_advisory)))
        def add_alias(d):
            by_ticket(d)['LAB-201']['aliases'] = ['CVE-2024-29041']
        self.assertTrue(self.rejected(self.mutate(add_alias)))

    def test_rejects_pr8_unblocked(self):
        def unblock(d):
            pr8 = by_number(d)[8]
            pr8['review_state'], pr8['blocked_reason'] = 'human-review', None
        self.assertTrue(self.rejected(self.mutate(unblock)))

    def test_rejects_typescript_match_without_compile_pass(self):
        def broken_compile(d):
            job = next(j for j in d['baselines']['jobs'] if j['name'] == 'TypeScript compile')
            job['result'], job['match'] = 'ERROR', False
        self.assertTrue(self.rejected(self.mutate(broken_compile)))

    def test_rejects_missing_finding_and_schema_violation(self):
        self.assertTrue(self.rejected(self.mutate(lambda d: d['findings'].pop())))
        self.assertTrue(self.rejected(self.mutate(lambda d: by_ticket(d)['DEP-101'].__setitem__('cwe', 'CWE-20'))))


if __name__ == '__main__':
    unittest.main()
