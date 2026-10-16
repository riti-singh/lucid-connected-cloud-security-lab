"""Synthetic lab: verify the PyYAML dependency scenario before and after upgrade. Requires network.

Before: install repos/diagnostics-document-api/requirements.txt into a throwaway venv, scan with pinned
pip-audit (OSV service), expect the advisory IDs recorded in data/advisory_candidates.json, run dependency_tests.
After: same with requirements-upgrade.txt (OSV fixed version); expect those advisories absent, tests pass.
Evidence is written to data/evidence/dependency-scenario/. Exits non-zero if any expectation fails.
"""
import argparse, datetime, json, os, platform, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = 'diagnostics-document-api'
SERVICE = ROOT / 'repos' / REPOSITORY
MANIFESTS = {'before': SERVICE / 'requirements.txt', 'after': SERVICE / 'requirements-upgrade.txt'}
SCANNER_REQUIREMENTS = ['pip==25.2', 'pip-audit==2.10.1']
# PyYAML 5.x sdists do not build with Cython 3; constrain the isolated build env.
BUILD_CONSTRAINTS = 'Cython<3\n'
TEST_COMMAND = ['-m', 'unittest', 'discover', '-s', 'dependency_tests', '-v']


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class Runner:
    def __init__(self, work):
        self.work, self.log = work, []

    def clean(self, text):
        return text.replace(str(self.work), '$WORKDIR').replace(str(ROOT), '$REPO')

    def run(self, args, cwd=ROOT, env=None, ok=(0,)):
        started = utc()
        p = subprocess.run([str(a) for a in args], cwd=cwd, env=env, capture_output=True, text=True)
        entry = {'command': self.clean(' '.join(str(a) for a in args)), 'cwd': self.clean(str(cwd)),
                 'env': {k: self.clean(v) for k, v in (env or {}).items() if k.startswith('PIP_') or k.startswith('PYTHON')},
                 'started_utc': started, 'finished_utc': utc(), 'returncode': p.returncode,
                 'stdout': self.clean(p.stdout), 'stderr': self.clean(p.stderr)}
        self.log.append(entry)
        if p.returncode not in ok:
            raise RuntimeError(f"command failed ({p.returncode}): {entry['command']}\n{p.stdout}{p.stderr}")
        return p


def rel(path):
    return str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path)


def manifest_pin(path):
    pins = [l.strip() for l in path.read_text().splitlines() if l.strip() and not l.startswith('#')]
    assert len(pins) == 1, pins
    name, version = re.fullmatch(r'([A-Za-z0-9_.-]+)==(\S+)', pins[0]).groups()
    return name, version


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--evidence-dir', type=Path, default=ROOT / 'data' / 'evidence' / 'dependency-scenario')
    ap.add_argument('--keep-workdir', action='store_true')
    a = ap.parse_args()

    candidates = json.loads((ROOT / 'data' / 'advisory_candidates.json').read_text())
    pin = next(p for p in candidates['pins'] if p['repository'] == REPOSITORY)
    expected_ids = sorted(adv['id'] for adv in pin['advisories'])
    fixed_versions = sorted({adv['fixed_version'] for adv in pin['advisories']})
    targets = {'before': manifest_pin(MANIFESTS['before']), 'after': manifest_pin(MANIFESTS['after'])}
    checks = []

    def check(name, passed, detail):
        checks.append({'check': name, 'passed': bool(passed), 'detail': detail})
        print(f"{'PASS' if passed else 'FAIL'} {name}: {detail}")

    check('before manifest matches recorded pin', targets['before'] == (pin['package'], pin['pinned_version']),
          f"{targets['before']} vs {(pin['package'], pin['pinned_version'])}")
    check('upgrade manifest pins the OSV fixed version', [targets['after'][1]] == fixed_versions,
          f"{targets['after'][1]} vs {fixed_versions}")

    if a.evidence_dir.exists():
        shutil.rmtree(a.evidence_dir)
    a.evidence_dir.mkdir(parents=True)
    work = Path(tempfile.mkdtemp(prefix='dependency-scenario-'))
    r = Runner(work)
    summary = {'synthetic': True, 'repository': REPOSITORY, 'started_utc': utc(), 'python': platform.python_version(),
               'scanner_requirements': SCANNER_REQUIREMENTS, 'build_constraints': BUILD_CONSTRAINTS.strip(),
               'expected_advisory_ids': expected_ids, 'phases': {}}
    try:
        scanner = work / 'scanner'
        r.run([sys.executable, '-m', 'venv', scanner])
        spy = scanner / 'bin' / 'python'
        r.run([spy, '-m', 'pip', 'install', '-q', '--disable-pip-version-check', *SCANNER_REQUIREMENTS])
        summary['scanner_version'] = r.run([scanner / 'bin' / 'pip-audit', '--version']).stdout.strip()
        (a.evidence_dir / 'scanner-freeze.txt').write_text(r.run([spy, '-m', 'pip', 'freeze', '--all']).stdout)
        constraints = work / 'build-constraints.txt'
        constraints.write_text(BUILD_CONSTRAINTS)
        pip_env = {**os.environ, 'PIP_CONSTRAINT': str(constraints)}
        test_env = {**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}

        for phase in ('before', 'after'):
            out = a.evidence_dir / phase
            out.mkdir()
            venv = work / phase
            r.run([sys.executable, '-m', 'venv', '--without-pip', venv])
            tpy = venv / 'bin' / 'python'
            r.run([spy, '-m', 'pip', '--python', tpy, 'install', '-q', '--disable-pip-version-check',
                   '-r', MANIFESTS[phase]], env=pip_env)
            (out / 'pip-freeze.txt').write_text(r.run([spy, '-m', 'pip', '--python', tpy, 'freeze', '--all']).stdout)
            installed = r.run([tpy, '-c', f"import importlib.metadata as m; print(m.version({targets[phase][0]!r}))"]).stdout.strip()
            site = r.run([tpy, '-c', "import sysconfig; print(sysconfig.get_paths()['purelib'])"]).stdout.strip()
            audit_json = out / 'pip-audit.json'
            scan = r.run([scanner / 'bin' / 'pip-audit', '--path', site, '--vulnerability-service', 'osv',
                          '--format', 'json', '--output', audit_json, '--progress-spinner', 'off'], ok=(0, 1))
            audit = json.loads(audit_json.read_text())
            found = sorted({i for d in audit['dependencies'] for v in d.get('vulns', []) for i in [v['id'], *v.get('aliases', [])]})
            tests = r.run([tpy, *TEST_COMMAND], cwd=SERVICE, env=test_env, ok=(0, 1))
            (out / 'tests.txt').write_text(tests.stdout + tests.stderr)

            check(f'{phase}: installed version', installed == targets[phase][1], f"{targets[phase][0]} {installed}")
            if phase == 'before':
                missing = [i for i in expected_ids if i not in found]
                check('before: scanner reports recorded advisories', not missing and scan.returncode == 1,
                      f"missing={missing} scanner_exit={scan.returncode}")
            else:
                present = [i for i in expected_ids if i in found]
                check('after: recorded advisories absent', not present, f"present={present} scanner_exit={scan.returncode}")
            check(f'{phase}: scenario tests pass', tests.returncode == 0, f"exit={tests.returncode}")
            summary['phases'][phase] = {'manifest': rel(MANIFESTS[phase]), 'installed': f"{targets[phase][0]}=={installed}",
                                        'scanner_exit': scan.returncode, 'scanner_ids_and_aliases': found,
                                        'tests_exit': tests.returncode, 'evidence': rel(out)}
    except Exception as exc:
        check('scenario run completed', False, str(exc).splitlines()[0])
    finally:
        summary['finished_utc'] = utc()
        summary['checks'] = checks
        summary['result'] = 'PASS' if checks and all(c['passed'] for c in checks) else 'FAIL'
        (a.evidence_dir / 'commands.json').write_text(json.dumps(r.log, indent=2) + '\n')
        (a.evidence_dir / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
        if not a.keep_workdir:
            shutil.rmtree(work, ignore_errors=True)
    print(f"{summary['result']} dependency scenario ({summary.get('scanner_version', 'scanner not installed')}); evidence: {rel(a.evidence_dir)}")
    sys.exit(0 if summary['result'] == 'PASS' else 1)


if __name__ == '__main__':
    main()
