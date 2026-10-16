import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
items=json.loads((root/'data/findings.json').read_text())
required={'ticket','repository','language','cwe','title','severity','source','verification_status','test_name','synthetic','root_cause_group'}
assert len({x['ticket'] for x in items})==len(items)
import re
lab=[x for x in items if re.fullmatch(r'LAB-\d{3}',x['ticket'])]
dep=[x for x in items if re.fullmatch(r'DEP-\d{3}',x['ticket'])]
assert len(lab)+len(dep)==len(items), f"unexpected ticket prefix: {[x['ticket'] for x in items if x not in lab and x not in dep]}"
for x in items:
 assert required.issubset(x), x
 assert x['synthetic'] is True and x['actual_lucid_finding'] is False
 assert (root/'repos'/x['repository']).exists()
for x in lab:
 assert x['advisory_id'] is None, f"LAB-* finding must not carry an advisory ID: {x['ticket']}"
for x in dep:
 assert x['requires_human_approval'] is True, x['ticket']
 aid=x['advisory_id']
 rec=root/'data/osv'/f"{aid}.json" if aid else None
 assert rec and rec.is_file(), f"{x['ticket']}: advisory_id {aid!r} has no data/osv/<advisory_id>.json record"
 osv=json.loads(rec.read_text())['response']
 assert osv['id']==aid, f"{x['ticket']}: data/osv/{aid}.json id is {osv['id']!r}"
 assert set(x.get('aliases',[]))<=set(osv.get('aliases',[])), f"{x['ticket']}: aliases not in OSV record {aid}"
assert {x['language'] for x in items} == {'Java','TypeScript','Python','Go'}
intake=[x for x in items if re.fullmatch(r'LAB-5\d\d',x['ticket'])]
for x in intake:
 assert x['requires_human_approval'] is True, x['ticket']
 ev=root/'data/evidence'/x['ticket']
 assert ev.is_dir() and any(f.is_file() for f in ev.iterdir()), f"missing evidence directory for {x['ticket']}: {ev}"
print(f"PASS schema/provenance audit: {len(items)} synthetic findings ({len(lab)} LAB-*, {len(dep)} DEP-*), 4 represented languages, no advisory IDs on LAB-* findings, {len(dep)} DEP-* advisory IDs matched to data/osv records, {len(intake)} LAB-5xx tickets with evidence directories")
