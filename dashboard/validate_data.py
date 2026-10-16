#!/usr/bin/env python3
"""Validate dashboard data.json against dashboard/schema/data.schema.json plus lab invariants.

Usage: python3 dashboard/validate_data.py [path]   (default dashboard/public/data.json)
Requires jsonschema (dashboard/requirements.txt).
"""
import datetime as dt
import json
import re
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / 'dashboard/schema/data.schema.json'
DEFAULT = ROOT / 'dashboard/public/data.json'
COMPILE_GATED = {'TypeScript tests': 'TypeScript compile', 'Java tests': 'Java compile'}


def schema_errors(data):
    validator = Draft202012Validator(json.loads(SCHEMA.read_text()))
    return [f"{'/'.join(str(p) for p in e.absolute_path) or '<root>'}: {e.message}"
            for e in sorted(validator.iter_errors(data), key=lambda e: [str(p) for p in e.absolute_path])]


def semantic_checks(data, source_findings):
    findings = data['findings']
    tickets = [f['ticket'] for f in findings]
    by_ticket = {f['ticket']: f for f in findings}
    assert len(set(tickets)) == len(tickets), f'duplicate tickets: {sorted(t for t in set(tickets) if tickets.count(t) > 1)}'

    src_tickets = {x['ticket'] for x in source_findings}
    assert set(tickets) == src_tickets, f'tickets differ from data/findings.json: {sorted(set(tickets) ^ src_tickets)}'
    lab = [f for f in findings if f['ticket'].startswith('LAB-')]
    dep = [f for f in findings if f['ticket'].startswith('DEP-')]
    src_lab = [x for x in source_findings if x['ticket'].startswith('LAB-')]
    assert (len(findings), len(lab), len(dep)) == (len(source_findings), len(src_lab), len(source_findings) - len(src_lab)), \
        f'counts {len(findings)} ({len(lab)} LAB, {len(dep)} DEP) differ from data/findings.json'

    for f in findings:
        intake = f['root_cause_group'] == 'intake-unclassified'
        assert (f['triage_state'] == 'untriaged') == intake, f"{f['ticket']}: triage_state {f['triage_state']} with group {f['root_cause_group']}"
        assert f['due_at'] == (dt.date.fromisoformat(f['reported_at']) + dt.timedelta(days=f['sla_days'])).isoformat(), \
            f"{f['ticket']}: due_at {f['due_at']} != reported_at + sla_days"
        expected_kind = 'dependency' if f['ticket'].startswith('DEP-') else 'intake' if re.fullmatch(r'LAB-5\d\d', f['ticket']) else 'code'
        assert f['kind'] == expected_kind, f"{f['ticket']}: kind {f['kind']} != {expected_kind}"
    for f in lab:
        assert f['advisory_id'] is None, f"LAB-* finding must not carry an advisory ID: {f['ticket']} ({f['advisory_id']})"
        assert not f['aliases'], f"LAB-* finding must not carry aliases: {f['ticket']} ({f['aliases']})"

    advisory_ids = {a['id'] for a in data['advisories']}
    for f in dep:
        assert f['advisory_id'] in advisory_ids, f"{f['ticket']}: advisory_id {f['advisory_id']!r} not in advisories"
    for a in data['advisories']:
        expected = sorted(f['ticket'] for f in dep
                          if f['advisory_id'] == a['id'] or a['id'] in f['aliases'] or f['advisory_id'] in a['aliases'])
        assert a['finding_ids'] == expected, \
            f"advisory {a['id']} finding_ids {a['finding_ids']} != {expected} (ID/alias match on DEP-* findings)"

    grouped = {}
    for g in data['root_cause_groups']:
        members = [by_ticket[t] for t in g['finding_ids'] if t in by_ticket]
        assert len(members) == len(g['finding_ids']), f"group {g['id']} lists unknown tickets"
        for t in g['finding_ids']:
            grouped.setdefault(t, []).append(g['id'])
        if g['id'] == 'intake-unclassified':
            assert g['classification'] == 'untriaged-intake', f"intake-unclassified classified as {g['classification']}"
        if g['classification'] == 'untriaged-intake':
            assert g['verified'] is False, f"untriaged-intake group {g['id']} must have verified false"
        if g['verified']:
            assert g['classification'] == 'code-root-cause', f"verified group {g['id']} is {g['classification']}"
            untriaged = [m['ticket'] for m in members if m['triage_state'] == 'untriaged' or m['kind'] == 'intake']
            assert not untriaged, f"verified group {g['id']} contains untriaged intake findings {untriaged}"
            unverified = [m['ticket'] for m in members if m['verification_status'] != 'reproduced_by_expected_failing_test']
            assert not unverified, f"verified group {g['id']} contains findings not reproduced by a failing test: {unverified}"
        assert all(m['root_cause_group'] == g['id'] for m in members), \
            f"group {g['id']} contains findings from other groups: {[m['ticket'] for m in members if m['root_cause_group'] != g['id']]}"
    for t in tickets:
        assert grouped.get(t) == [by_ticket[t]['root_cause_group']], f"{t}: group membership {grouped.get(t)} != {by_ticket[t]['root_cause_group']}"

    gh_status = data['sources']['github']['status']
    numbers = [r['number'] for r in data['remediations']]
    assert len(set(numbers)) == len(numbers), 'duplicate remediation PR numbers'
    for r in data['remediations']:
        n = f"PR #{r['number']}"
        if r['state_source'] == 'github':
            assert r['github'] is not None and gh_status in ('ok', 'partial'), f'{n}: state_source github without GitHub data'
            assert r['state'] == ('merged' if r['github']['merged'] else r['github']['state']), f'{n}: state disagrees with github'
        else:
            assert r['state'] == r['recorded_state'], f"{n}: recorded state_source but state {r['state']} != recorded_state {r['recorded_state']}"
        unassigned = [t for t in r['tickets'] if t in by_ticket and not by_ticket[t]['owner_assigned']]
        if r['state'] == 'open' and unassigned:
            assert r['review_state'] == 'blocked-owner-assignment', \
                f"{n} is open and linked to unassigned-owner findings {unassigned} but review_state is {r['review_state']}"
            assert r['blocked_reason'], f'{n}: blocked-owner-assignment without blocked_reason'
        if r['review_state'] == 'blocked-owner-assignment':
            assert r['state'] == 'open' and unassigned, f'{n}: blocked-owner-assignment but not open with an unassigned owner'
        if r['category'] == 'remediation':
            for t in r['tickets']:
                assert r['number'] in by_ticket[t]['remediation_pr_numbers'], f"{t}: missing remediation PR {r['number']}"

    jobs = {j['name']: j for j in data['baselines']['jobs']}
    for tests, compile_job in COMPILE_GATED.items():
        if tests in jobs and jobs[tests]['match']:
            assert compile_job in jobs and jobs[compile_job]['result'] == 'PASS', \
                f'baselines: {tests} MATCH without a {compile_job} PASS is not a valid result'
    return len(findings), len(lab), len(dep), len(data['root_cause_groups']), len(data['remediations'])


def main(argv):
    path = Path(argv[1]) if len(argv) > 1 else DEFAULT
    data = json.loads(path.read_text())
    errors = schema_errors(data)
    if errors:
        for e in errors:
            print(f'FAIL schema: {e}')
        print(f'FAIL {path}: {len(errors)} schema error(s)')
        return 1
    try:
        counts = semantic_checks(data, json.loads((ROOT / 'data/findings.json').read_text()))
    except AssertionError as e:
        print(f'FAIL {path}: {e}')
        return 1
    print(f'PASS dashboard data: schema 2020-12 valid; {counts[0]} findings ({counts[1]} LAB-*, {counts[2]} DEP-*) match '
          f'data/findings.json, {counts[3]} root-cause groups (intake untriaged, never verified), no advisory IDs on LAB-*, '
          f'{counts[4]} remediations with owner-assignment blocks enforced')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
