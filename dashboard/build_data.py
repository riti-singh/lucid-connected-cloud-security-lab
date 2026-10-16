#!/usr/bin/env python3
"""Build dashboard/public/data.json (see dashboard/schema/data.schema.json).

Standard library only. Surfaces the outputs of tools/audit_findings.py, tools/triage.py and
tools/run_baselines.py; it does not reimplement them. GitHub data (GITHUB_TOKEN optional) is
authoritative for PR state; on failure the curated data/remediations.json state is used.
"""
import argparse
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OWNER, NAME = 'riti-singh', 'lucid-connected-cloud-security-lab'
REPO_URL = f'https://github.com/{OWNER}/{NAME}'
PAGES_URL = f'https://{OWNER}.github.io/{NAME}/'
DEFAULT_BRANCH = 'main'
DEFAULT_OUT = ROOT / 'dashboard/public/data.json'
API = 'https://api.github.com'
TIMEOUT = 15
PREVIEW_BYTES = 4096
BASELINE_ARTIFACTS = ['repos/charging-session-api/dist', 'repos/ota-release-gateway/build']
WORKFLOWS = {'lab_validation_main': 'lab-validation.yml', 'deploy_dashboard_main': 'deploy-dashboard.yml'}
FAILED_CONCLUSIONS = {'failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure', 'stale'}
TEXT_SUFFIXES = {'.md': 'text/markdown', '.txt': 'text/plain', '.json': 'application/json', '.log': 'text/plain'}
JOB_RE = re.compile(r'^(?P<name>[A-Za-z][A-Za-z ]*?): (?P<result>PASS|FAIL); expected (?P<expected>PASS|FAIL); (?P<match>MATCH|MISMATCH)$')
JOB_ERROR_RE = re.compile(r'^ERROR (?P<name>[A-Za-z][A-Za-z ]*?): ')
SUMMARY_RE = re.compile(r'^(PASS .*|ERROR \d+ job\(s\) could not run.*)$')
TRIAGE_RE = re.compile(r'^(?P<group>[^:\s]+): (?P<tickets>[^;]+); source=(?P<source>[^;]+);')


class BuildError(Exception):
    pass


class GitHubError(Exception):
    pass


class RateLimitError(GitHubError):
    pass


class NotFound(GitHubError):
    pass


def utcnow():
    return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def iso_z(value):
    """Normalize an ISO-8601 datetime string to second precision with Z; dates pass through."""
    if value is None or re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        return value
    parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def sort_key_time(value):
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        return dt.datetime.fromisoformat(value).replace(tzinfo=dt.timezone.utc)
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00'))


def load_json(rel):
    return json.loads((ROOT / rel).read_text())


def rel(path):
    return path.relative_to(ROOT).as_posix()


class Links:
    def __init__(self, ref):
        self.ref = ref or DEFAULT_BRANCH

    def url(self, path):
        kind = 'tree' if path.endswith('/') or (ROOT / path).is_dir() else 'blob'
        return f'{REPO_URL}/{kind}/{self.ref}/{path.rstrip("/")}'

    def ref_obj(self, path, bundle_id=None):
        return {'path': path, 'url': self.url(path), 'bundle_id': bundle_id}


def commit_sha():
    if os.environ.get('GITHUB_SHA'):
        return os.environ['GITHUB_SHA']
    try:
        p = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True, timeout=15)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return p.stdout.strip() if p.returncode == 0 else None


def normalize_cwe(value):
    if isinstance(value, str):
        return [value]
    return list(value)


def finding_kind(ticket):
    if ticket.startswith('DEP-'):
        return 'dependency'
    if re.fullmatch(r'LAB-5\d\d', ticket):
        return 'intake'
    return 'code'


def due_date(reported_at, sla_days):
    return (dt.date.fromisoformat(reported_at) + dt.timedelta(days=sla_days)).isoformat()


# ---------------------------------------------------------------- lab tools

def run_tool(script, args=(), timeout=120):
    cmd = [sys.executable, script, *args]
    p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    return {'command': ' '.join(['python3', script, *args]), 'exit_code': p.returncode,
            'stdout': p.stdout, 'stderr': p.stderr, 'passed': p.returncode == 0}


def parse_triage(stdout):
    entries = []
    for line in stdout.splitlines():
        m = TRIAGE_RE.match(line)
        if m:
            tickets = [t.strip() for t in m['tickets'].split(',') if t.strip()]
            entries.append({'group': m['group'], 'tickets': tickets, 'source': m['source'], 'line': line})
    return entries


def classify_group(group_id, members):
    if group_id == 'intake-unclassified':
        return 'untriaged-intake', False
    if group_id.startswith('dependency-') or all(m['ticket'].startswith('DEP-') for m in members):
        return 'dependency-advisory', False
    verified = bool(members) and all(m['verification_status'] == 'reproduced_by_expected_failing_test' for m in members)
    return 'code-root-cause', verified


def build_groups(triage_entries, raw_findings, remediation_prs):
    by_group = {}
    for f in raw_findings:
        by_group.setdefault(f['root_cause_group'], []).append(f)
    triage_groups = {e['group']: e for e in triage_entries}
    if set(triage_groups) != set(by_group):
        raise BuildError(f'triage groups {sorted(triage_groups)} != findings.json groups {sorted(by_group)}')
    groups = []
    for e in triage_entries:
        members = by_group[e['group']]
        expected = sorted(m['ticket'] for m in members)
        if sorted(e['tickets']) != expected:
            raise BuildError(f"triage group {e['group']} lists {e['tickets']}, findings.json has {expected}")
        classification, verified = classify_group(e['group'], members)
        tickets = set(expected)
        groups.append({
            'id': e['group'],
            'classification': classification,
            'verified': verified,
            'finding_ids': expected,
            'source': e['source'],
            'triage_line': e['line'],
            'remediation_pr_numbers': sorted(pr['number'] for pr in remediation_prs
                                             if pr['category'] == 'remediation' and tickets & set(pr['tickets'])),
            'advisory_ids': sorted({m['advisory_id'] for m in members if m.get('advisory_id')}),
        })
    return groups


def parse_baselines(text):
    jobs, summary = [], None
    for line in text.splitlines():
        line = line.rstrip()
        m = JOB_RE.match(line)
        if m:
            jobs.append({'name': m['name'], 'language': job_language(m['name']), 'result': m['result'],
                         'expected': m['expected'], 'match': m['match'] == 'MATCH'})
            continue
        m = JOB_ERROR_RE.match(line)
        if m:
            jobs.append({'name': m['name'], 'language': job_language(m['name']), 'result': 'ERROR',
                         'expected': None, 'match': False})
            continue
        if SUMMARY_RE.match(line):
            summary = line
    return jobs, summary


def job_language(name):
    for prefix, lang in (('Python', 'python'), ('TypeScript', 'typescript'), ('Java', 'java'), ('Go', 'go')):
        if name == prefix or name.startswith(prefix + ' '):
            return lang
    return None


def collect_baselines(run):
    if run:
        try:
            p = subprocess.run([sys.executable, 'tools/run_baselines.py'], cwd=ROOT, capture_output=True,
                               text=True, timeout=900)
        finally:
            for d in BASELINE_ARTIFACTS:
                shutil.rmtree(ROOT / d, ignore_errors=True)
        raw = p.stdout + (p.stderr if p.stderr else '')
        jobs, summary = parse_baselines(p.stdout)
        result = {'source': 'run_baselines.py', 'command': 'python3 tools/run_baselines.py', 'exit_code': p.returncode,
                  'jobs': jobs, 'summary_line': summary, 'raw': raw, 'captured_at': utcnow()}
        note = f'tools/run_baselines.py run during the build; {", ".join(BASELINE_ARTIFACTS)} removed afterwards.'
    else:
        raw = (ROOT / 'baseline-results.txt').read_text()
        jobs, summary = parse_baselines(raw)
        result = {'source': 'baseline-results.txt', 'command': 'python3 tools/run_baselines.py', 'exit_code': None,
                  'jobs': jobs, 'summary_line': summary, 'raw': raw, 'captured_at': None}
        note = 'Parsed from the committed baseline-results.txt; the runner was not executed in this build.'
    return result, {'source': result['source'], 'note': note}


# ---------------------------------------------------------------- GitHub

class GitHub:
    def __init__(self, token=None):
        self.token = token
        self.rate_limit_remaining = None

    def get(self, path):
        headers = {'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
                   'User-Agent': f'{NAME}-dashboard-build'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        req = urllib.request.Request(API + path, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                self._track(resp.headers)
                return json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            self._track(e.headers)
            body = ''
            try:
                body = e.read().decode('utf-8', 'replace')
            except Exception:
                pass
            remaining = (e.headers or {}).get('X-RateLimit-Remaining')
            if e.code in (403, 429) and (remaining == '0' or 'rate limit' in body.lower()):
                raise RateLimitError(f'GitHub API rate limit exceeded on GET {path}{self._reset(e.headers)}') from None
            if e.code == 404:
                raise NotFound(f'GET {path}: HTTP 404') from None
            raise GitHubError(f'GET {path}: HTTP {e.code} {e.reason}') from None
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
            raise GitHubError(f'GET {path}: {getattr(e, "reason", e)}') from None

    def _track(self, headers):
        value = (headers or {}).get('X-RateLimit-Remaining')
        if value is not None and str(value).isdigit():
            self.rate_limit_remaining = int(value)

    @staticmethod
    def _reset(headers):
        headers = headers or {}
        reset = headers.get('X-RateLimit-Reset')
        if reset and str(reset).isdigit():
            at = dt.datetime.fromtimestamp(int(reset), dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
            return f'; resets at {at}'
        if headers.get('Retry-After'):
            return f"; retry after {headers['Retry-After']} s"
        return ''


def checks_conclusion(checks):
    if not checks:
        return 'none'
    if any(c['status'] != 'completed' for c in checks):
        return 'pending'
    if any(c['conclusion'] in FAILED_CONCLUSIONS for c in checks):
        return 'failure'
    if all(c['conclusion'] in ('success', 'neutral', 'skipped') for c in checks):
        return 'success'
    return 'unknown'


def workflow_run(run):
    return {'name': run.get('name') or '', 'status': run.get('status') or '', 'conclusion': run.get('conclusion'),
            'html_url': run.get('html_url') or '', 'head_sha': run.get('head_sha') or '',
            'event': run.get('event') or '', 'created_at': iso_z(run['created_at'])}


def fetch_github(recorded_prs, token):
    """Return (sources.github, {number: github_pr}, ci, {number: pr title/created_at})."""
    gh = GitHub(token)
    errors, pr_github, pr_meta = [], {}, {}
    ci = {key: None for key in WORKFLOWS}
    status = {'status': 'ok', 'authenticated': bool(token), 'fetched_at': None, 'error': None,
              'rate_limit_remaining': None}
    base = f'/repos/{OWNER}/{NAME}'
    try:
        pulls, page = [], 1
        while True:
            batch = gh.get(f'{base}/pulls?state=all&per_page=100&page={page}')
            pulls.extend(batch)
            if len(batch) < 100:
                break
            page += 1
    except GitHubError as e:
        status.update(status='unavailable', error=str(e), rate_limit_remaining=gh.rate_limit_remaining)
        return status, {}, ci, {}
    fetched_at = utcnow()
    status['fetched_at'] = fetched_at
    by_number = {p['number']: p for p in pulls}
    recorded_numbers = {pr['number'] for pr in recorded_prs}
    extra = sorted(set(by_number) - recorded_numbers)
    if extra:
        print(f'note: GitHub PRs not in data/remediations.json (not added): {", ".join(f"#{n}" for n in extra)}',
              file=sys.stderr)
    rate_limited = False
    for pr in sorted(recorded_prs, key=lambda p: p['number']):
        live = by_number.get(pr['number'])
        if live is None:
            errors.append(f"PR #{pr['number']} not returned by GitHub")
            continue
        checks, conclusion = [], 'unknown'
        if not rate_limited:
            try:
                runs = gh.get(f"{base}/commits/{live['head']['sha']}/check-runs?per_page=100")
                checks = sorted(({'name': c.get('name') or '', 'status': c.get('status') or '',
                                  'conclusion': c.get('conclusion'), 'html_url': c.get('html_url'),
                                  'completed_at': iso_z(c.get('completed_at'))}
                                 for c in runs.get('check_runs', [])), key=lambda c: (c['name'], c['html_url'] or ''))
                conclusion = checks_conclusion(checks)
            except RateLimitError as e:
                rate_limited = True
                errors.append(str(e))
            except GitHubError as e:
                errors.append(str(e))
        pr_github[pr['number']] = {
            'state': live['state'],
            'merged': bool(live.get('merged_at')),
            'draft': bool(live.get('draft')),
            'merged_at': iso_z(live.get('merged_at')),
            'closed_at': iso_z(live.get('closed_at')),
            'head_sha': live['head']['sha'],
            'updated_at': iso_z(live['updated_at']),
            'html_url': live['html_url'],
            'requested_reviewers': sorted([u['login'] for u in live.get('requested_reviewers') or []]
                                          + [t['slug'] for t in live.get('requested_teams') or []]),
            'checks': checks,
            'checks_conclusion': conclusion,
            'fetched_at': fetched_at,
        }
        pr_meta[pr['number']] = {'title': live.get('title'), 'created_at': iso_z(live.get('created_at'))}
    for key, workflow in WORKFLOWS.items():
        if rate_limited:
            break
        try:
            runs = gh.get(f'{base}/actions/workflows/{workflow}/runs?branch={DEFAULT_BRANCH}&per_page=1')
            if runs.get('workflow_runs'):
                ci[key] = workflow_run(runs['workflow_runs'][0])
        except NotFound:
            if key == 'lab_validation_main':
                errors.append(f'workflow {workflow} not found')
        except RateLimitError as e:
            rate_limited = True
            errors.append(str(e))
        except GitHubError as e:
            errors.append(str(e))
    if errors:
        status.update(status='partial', error='; '.join(errors))
    status['rate_limit_remaining'] = gh.rate_limit_remaining
    return status, pr_github, ci, pr_meta


# ---------------------------------------------------------------- evidence

def media_type(path):
    name = path.name.lower()
    if name.endswith('.sarif.json'):
        return 'application/sarif+json'
    return TEXT_SUFFIXES.get(path.suffix.lower(), 'application/octet-stream')


def evidence_file(path, links):
    data = path.read_bytes()
    preview, truncated = None, False
    head = data[:PREVIEW_BYTES]
    try:
        preview = head.decode('utf-8')
    except UnicodeDecodeError as e:
        # a multi-byte character may be cut at the preview boundary
        if len(data) > PREVIEW_BYTES and e.start >= len(head) - 3:
            preview = head[:e.start].decode('utf-8')
    if preview is not None:
        truncated = len(data) > PREVIEW_BYTES
    return {'path': rel(path), 'url': links.url(rel(path)), 'size_bytes': len(data),
            'media_type': media_type(path), 'preview': preview, 'truncated': truncated}


def build_evidence_bundles(raw_findings, links):
    bundles = []
    ev_root = ROOT / 'data/evidence'
    for d in sorted(p for p in ev_root.iterdir() if p.is_dir()):
        files = [evidence_file(f, links) for f in sorted(d.rglob('*')) if f.is_file()]
        path = rel(d) + '/'
        if re.fullmatch(r'LAB-5\d\d', d.name):
            bundles.append({'id': d.name, 'kind': 'intake-evidence', 'path': path, 'tickets': [d.name],
                            'summary': None, 'files': files})
        elif d.name == 'dependency-scenario':
            tickets = sorted(f['ticket'] for f in raw_findings
                             if any(e.rstrip('/') == path.rstrip('/') for e in f.get('evidence', [])))
            summary_path = d / 'summary.json'
            summary = json.loads(summary_path.read_text()) if summary_path.is_file() else None
            bundles.append({'id': d.name, 'kind': 'dependency-scenario', 'path': path, 'tickets': tickets,
                            'summary': summary, 'files': files})
    return bundles


def bundle_for(path, bundles):
    for b in bundles:
        if path.rstrip('/') == b['path'].rstrip('/') or path.startswith(b['path']):
            return b['id']
    return None


def test_file_refs(service, test_name, links):
    svc = ROOT / 'repos' / service
    if not test_name or not svc.is_dir():
        return []
    refs = []
    for f in sorted(svc.rglob('*')):
        parts = set(f.relative_to(svc).parts)
        if not f.is_file() or parts & {'dist', 'build', 'node_modules'} or 'test' not in f.name.lower():
            continue
        try:
            if test_name in f.read_text(errors='replace'):
                refs.append(links.ref_obj(rel(f)))
        except OSError:
            continue
    return refs


# ---------------------------------------------------------------- advisories

def version_key(v):
    key = []
    for part in re.split(r'[.\-+]', v):
        key.append((1, int(part), '') if part.isdigit() else (0, 0, part))
    return key


def in_range(version, events):
    introduced = next((e['introduced'] for e in events if 'introduced' in e), '0')
    fixed = next((e['fixed'] for e in events if 'fixed' in e), None)
    lo_ok = introduced == '0' or version_key(introduced) <= version_key(version)
    return lo_ok and (fixed is None or version_key(version) < version_key(fixed)), fixed


def advisory_package(osv, linked):
    affected = osv.get('affected') or []
    if linked:
        f = linked[0]
        matches = [a for a in affected if a.get('package', {}).get('name', '').lower() == (f.get('package') or '').lower()
                   and a.get('package', {}).get('ecosystem', '').lower() == (f.get('ecosystem') or '').lower()]
    else:
        names = {(a.get('package', {}).get('ecosystem'), a.get('package', {}).get('name')) for a in affected}
        matches = affected if len(names) == 1 else []
    if not matches:
        return None, None, None
    pkg = matches[0]['package']
    fixed_versions = []
    pinned = linked[0].get('pinned_version') if linked else None
    for a in matches:
        for r in a.get('ranges', []):
            ok, fixed = in_range(pinned, r.get('events', [])) if pinned else (True, None)
            fixed = fixed or next((e['fixed'] for e in r.get('events', []) if 'fixed' in e), None)
            if ok and fixed:
                fixed_versions.append(fixed)
    return pkg.get('ecosystem'), pkg.get('name'), (fixed_versions[0] if fixed_versions else None)


def build_advisories(raw_findings):
    advisories, inputs = [], []
    for path in sorted((ROOT / 'data/osv').glob('*.json')):
        inputs.append(rel(path))
        if path.name.endswith('.query.json'):
            continue
        doc = json.loads(path.read_text())
        osv = doc.get('response')
        if not isinstance(osv, dict) or not osv.get('id'):
            continue
        linked = sorted((f for f in raw_findings if f['ticket'].startswith('DEP-') and f.get('advisory_id') == osv['id']),
                        key=lambda f: f['ticket'])
        ecosystem, package, fixed = advisory_package(osv, linked)
        for f in linked:
            if f.get('fixed_version') and fixed and f['fixed_version'] != fixed:
                print(f"note: {f['ticket']} fixed_version {f['fixed_version']} != OSV range fix {fixed}", file=sys.stderr)
        db = osv.get('database_specific') or {}
        advisories.append({
            'id': osv['id'],
            'aliases': list(osv.get('aliases') or []),
            'summary': osv.get('summary') or '',
            'details': osv.get('details') or '',
            'severity': db.get('severity'),
            'cwe_ids': list(db.get('cwe_ids') or []),
            'published': osv.get('published'),
            'modified': osv.get('modified'),
            'retrieved_utc': doc.get('retrieved_utc') or '',
            'ecosystem': ecosystem,
            'package': package,
            'fixed_version': fixed,
            'references': [{'type': r.get('type', ''), 'url': r.get('url', '')} for r in osv.get('references') or []],
            'finding_ids': [f['ticket'] for f in linked],
            'osv_path': rel(path),
            'osv_url': f"https://osv.dev/vulnerability/{osv['id']}",
        })
    return sorted(advisories, key=lambda a: a['id']), inputs


# ---------------------------------------------------------------- remediations

def build_remediations(recorded_prs, pr_github, pr_meta, raw_findings, inventory_owner):
    owner_of = {f['ticket']: (f['repository'], f['owner']) for f in raw_findings}
    out = []
    for pr in sorted(recorded_prs, key=lambda p: p['number']):
        live = pr_github.get(pr['number'])
        if live:
            state = 'merged' if live['merged'] else live['state']
            source = 'github'
        else:
            state, source = pr['recorded_state'], 'recorded'
        unassigned = sorted({owner_of[t][0] for t in pr['tickets'] if t in owner_of
                             and (owner_of[t][1] == 'unassigned' or inventory_owner.get(owner_of[t][0]) == 'unassigned')})
        blocked_reason = None
        if state == 'merged':
            review = 'merged'
        elif state == 'closed':
            review = 'closed'
        elif unassigned:
            review = 'blocked-owner-assignment'
            blocked_reason = '; '.join(f"{svc} owner is 'unassigned' in data/inventory.json; a human must assign an "
                                       f"owner and reviewer before merge." for svc in unassigned)
        else:
            review = 'human-review'
        meta = pr_meta.get(pr['number'], {})
        out.append({
            'number': pr['number'],
            'title': meta.get('title') or pr['title'],
            'category': pr['category'],
            'url': live['html_url'] if live else f"{REPO_URL}/pull/{pr['number']}",
            'tickets': list(pr['tickets']),
            'root_cause_group': pr['root_cause_group'],
            'service': pr['service'],
            'fixed_language': pr['fixed_language'],
            'state': state,
            'state_source': source,
            'review_state': review,
            'blocked_reason': blocked_reason,
            'created_at': meta.get('created_at') or pr['created_at'],
            'merged_at': live['merged_at'] if live else pr['merged_at'],
            'session_id': pr['session_id'],
            'session_url': f"https://app.devin.ai/sessions/{pr['session_id']}" if pr['session_id'] else None,
            'depends_on': list(pr['depends_on']),
            'validation': pr['validation'],
            'summary': pr['summary'],
            'recorded_state': pr['recorded_state'],
            'github': live,
        })
    return out


def finding_status(prs):
    if not prs:
        return 'open', None
    if any(p['state'] == 'merged' for p in prs):
        return 'fix-merged', None
    blocked = [p for p in prs if p['review_state'] == 'blocked-owner-assignment']
    if blocked:
        return 'fix-blocked', blocked[0]['blocked_reason']
    if any(p['state'] == 'open' for p in prs):
        return 'fix-in-review', None
    return 'open', None


def build_findings(raw_findings, inventory_owner, remediations, bundles, links):
    out = []
    for f in sorted(raw_findings, key=lambda x: x['ticket']):
        ticket, kind = f['ticket'], finding_kind(f['ticket'])
        linked = [r for r in remediations if r['category'] == 'remediation' and ticket in r['tickets']]
        status, blocked_reason = finding_status(linked)
        if kind == 'dependency':
            evidence = [links.ref_obj(p, bundle_for(p, bundles)) for p in f.get('evidence', [])]
        elif kind == 'intake':
            p = f'data/evidence/{ticket}/'
            evidence = [links.ref_obj(p, bundle_for(p, bundles))] if (ROOT / p).is_dir() else []
        else:
            evidence = test_file_refs(f['repository'], f.get('test_name'), links)
        owner = f['owner']
        out.append({
            'ticket': ticket,
            'kind': kind,
            'repository': f['repository'],
            'language': f['language'],
            'cwe': normalize_cwe(f['cwe']),
            'title': f['title'],
            'severity': f['severity'],
            'owner': owner,
            'owner_assigned': owner != 'unassigned' and inventory_owner.get(f['repository']) != 'unassigned',
            'sla_days': f['sla_days'],
            'reported_at': f['reported_at'],
            'due_at': due_date(f['reported_at'], f['sla_days']),
            'source': f['source'],
            'verification_status': f['verification_status'],
            'verification_notes': f.get('verification_notes'),
            'test_name': f.get('test_name'),
            'root_cause_group': f['root_cause_group'],
            'triage_state': 'untriaged' if f['root_cause_group'] == 'intake-unclassified' else 'triaged',
            'advisory_id': f.get('advisory_id'),
            'aliases': list(f.get('aliases') or []),
            'ecosystem': f.get('ecosystem'),
            'package': f.get('package'),
            'pinned_version': f.get('pinned_version'),
            'fixed_version': f.get('fixed_version'),
            'severity_source': f.get('severity_source'),
            'evidence': evidence,
            'remediation_pr_numbers': sorted(r['number'] for r in linked),
            'status': status,
            'blocked_reason': blocked_reason,
            'synthetic': f['synthetic'],
            'actual_lucid_finding': f['actual_lucid_finding'],
            'requires_human_approval': f['requires_human_approval'],
        })
    return out


def build_services(inventory, findings, links):
    out = []
    for s in inventory['repositories']:
        members = [f for f in findings if f['repository'] == s['repo']]
        languages = sorted({f['language'] for f in members})
        if len(languages) != 1:
            raise BuildError(f"service {s['repo']}: expected one language across findings, got {languages}")
        out.append({'repo': s['repo'], 'owner': s['owner'], 'owner_assigned': s['owner'] != 'unassigned',
                    'criticality': s['criticality'], 'deployment': s['deployment'],
                    'data_classification': s['data_classification'], 'language': languages[0],
                    'finding_ids': sorted(f['ticket'] for f in members),
                    'source_url': links.url(f"repos/{s['repo']}/")})
    return sorted(out, key=lambda s: s['repo'])


def build_history(findings, advisories, remediations, bundles, ci):
    events = []
    for r in remediations:
        ref = f"#{r['number']}"
        if r['created_at']:
            events.append({'at': iso_z(r['created_at']), 'type': 'pr-opened', 'summary': f"{ref} opened: {r['title']}",
                           'ref': ref, 'url': r['url']})
        if r['state'] == 'merged' and r['merged_at']:
            events.append({'at': iso_z(r['merged_at']), 'type': 'pr-merged', 'summary': f"{ref} merged: {r['title']}",
                           'ref': ref, 'url': r['url']})
        if r['state'] == 'closed' and r['github'] and r['github']['closed_at']:
            events.append({'at': r['github']['closed_at'], 'type': 'pr-closed',
                           'summary': f"{ref} closed without merge: {r['title']}", 'ref': ref, 'url': r['url']})
    for f in findings:
        events.append({'at': f['reported_at'], 'type': 'finding-reported', 'summary': f"{f['ticket']} reported: {f['title']}",
                       'ref': f['ticket'], 'url': None})
    for a in advisories:
        if a['retrieved_utc']:
            events.append({'at': iso_z(a['retrieved_utc']), 'type': 'advisory-retrieved',
                           'summary': f"{a['id']} retrieved from OSV", 'ref': a['id'], 'url': a['osv_url']})
    for b in bundles:
        if b['kind'] == 'dependency-scenario' and b['summary']:
            at = b['summary'].get('finished_utc') or b['summary'].get('started_utc')
            if at:
                events.append({'at': iso_z(at), 'type': 'evidence-captured',
                               'summary': f"Dependency scenario evidence captured ({', '.join(b['tickets'])}; result "
                                          f"{b['summary'].get('result')})", 'ref': b['path'], 'url': None})
    run = ci.get('lab_validation_main')
    if run:
        events.append({'at': run['created_at'], 'type': 'ci-run',
                       'summary': f"lab-validation on {DEFAULT_BRANCH}: {run['conclusion'] or run['status']}",
                       'ref': run['html_url'], 'url': run['html_url']})
    events.sort(key=lambda e: (sort_key_time(e['at']), e['type'], e['ref'] or ''), reverse=True)
    return events


# ---------------------------------------------------------------- main

def build(run_baselines=False, use_github=True, token=None):
    sha = commit_sha()
    links = Links(sha)
    raw_findings = load_json('data/findings.json')
    inventory = load_json('data/inventory.json')
    recorded = load_json('data/remediations.json')
    inventory_owner = {s['repo']: s['owner'] for s in inventory['repositories']}
    recorded_prs = recorded['pull_requests']

    audit = run_tool('tools/audit_findings.py')
    triage = run_tool('tools/triage.py')
    if not triage['passed']:
        raise BuildError(f"tools/triage.py exited {triage['exit_code']}: {triage['stderr'].strip()}")
    groups = build_groups(parse_triage(triage['stdout']), raw_findings, recorded_prs)

    if use_github:
        gh_status, pr_github, ci, pr_meta = fetch_github(recorded_prs, token)
    else:
        gh_status = {'status': 'skipped', 'authenticated': False, 'fetched_at': None, 'error': None,
                     'rate_limit_remaining': None}
        pr_github, ci, pr_meta = {}, {key: None for key in WORKFLOWS}, {}

    bundles = build_evidence_bundles(raw_findings, links)
    advisories, osv_inputs = build_advisories(raw_findings)
    remediations = build_remediations(recorded_prs, pr_github, pr_meta, raw_findings, inventory_owner)
    findings = build_findings(raw_findings, inventory_owner, remediations, bundles, links)
    baselines, baseline_source = collect_baselines(run_baselines)

    demonstrated = []
    for d in recorded.get('demonstrated_remediations', []):
        d = dict(d)
        d['evidence'] = [links.ref_obj(p, bundle_for(p, bundles)) for p in d.get('evidence', [])]
        demonstrated.append(d)
    sessions = [{'id': s['id'], 'url': f"https://app.devin.ai/sessions/{s['id']}", 'role': s['role'],
                 'pr_numbers': list(s['pr_numbers'])} for s in recorded.get('sessions', [])]

    inputs = ['data/findings.json', 'data/inventory.json', 'data/remediations.json', 'data/evidence/',
              'tools/audit_findings.py', 'tools/triage.py', *osv_inputs,
              'tools/run_baselines.py' if run_baselines else 'baseline-results.txt']
    return {
        'schema_version': '1.0',
        'generated_at': utcnow(),
        'synthetic': True,
        'disclaimer': 'All tickets, services, owners, and findings are synthetic lab data; '
                      'LAB-* and DEP-* tickets are not real Lucid findings.',
        'repository': {'owner': OWNER, 'name': NAME, 'url': REPO_URL, 'default_branch': DEFAULT_BRANCH,
                       'commit_sha': sha, 'pages_url': PAGES_URL},
        'sources': {'github': gh_status, 'baselines': baseline_source, 'inputs': sorted(inputs)},
        'services': build_services(inventory, findings, links),
        'findings': findings,
        'root_cause_groups': groups,
        'advisories': advisories,
        'remediations': remediations,
        'demonstrated_remediations': demonstrated,
        'combined_validations': list(recorded.get('combined_validations', [])),
        'escalations': list(recorded.get('escalations', [])),
        'sessions': sessions,
        'evidence_bundles': bundles,
        'baselines': baselines,
        'audits': {'audit_findings': audit, 'triage': triage},
        'ci': ci,
        'history': build_history(findings, advisories, remediations, bundles, ci),
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--out', default=str(DEFAULT_OUT), help='output path (default: dashboard/public/data.json)')
    ap.add_argument('--run-baselines', action='store_true', help='run tools/run_baselines.py instead of parsing baseline-results.txt')
    ap.add_argument('--no-github', action='store_true', help='skip GitHub API enrichment (recorded PR state only)')
    opts = ap.parse_args(argv)
    try:
        data = build(run_baselines=opts.run_baselines, use_github=not opts.no_github,
                     token=os.environ.get('GITHUB_TOKEN') or None)
    except BuildError as e:
        print(f'ERROR {e}', file=sys.stderr)
        return 1
    out = Path(opts.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    gh = data['sources']['github']
    print(f"wrote {out} ({len(data['findings'])} findings, {len(data['remediations'])} PRs, "
          f"{len(data['advisories'])} advisories; github: {gh['status']}"
          f"{' (' + gh['error'] + ')' if gh['error'] else ''}; baselines: {data['baselines']['source']}"
          f"{' exit ' + str(data['baselines']['exit_code']) if data['baselines']['exit_code'] is not None else ''})")
    return 0


if __name__ == '__main__':
    sys.exit(main())
