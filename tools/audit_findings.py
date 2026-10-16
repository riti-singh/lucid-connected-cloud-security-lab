import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
items=json.loads((root/'data/findings.json').read_text())
required={'ticket','repository','language','cwe','title','severity','source','verification_status','test_name','synthetic','root_cause_group'}
assert len({x['ticket'] for x in items})==len(items)
for x in items:
 assert required.issubset(x), x
 assert x['synthetic'] is True and x['actual_lucid_finding'] is False
 assert x['advisory_id'] is None
 assert (root/'repos'/x['repository']).exists()
assert {x['language'] for x in items} == {'Java','TypeScript','Python','Go'}
print(f"PASS schema/provenance audit: {len(items)} synthetic findings, 4 represented languages, no unsupported CVE claims")
