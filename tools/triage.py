import json
from pathlib import Path
from collections import defaultdict
root=Path(__file__).resolve().parents[1]
items=json.loads((root/'data/findings.json').read_text())
groups=defaultdict(list)
for x in items: groups[x['root_cause_group']].append(x)
print(f"{len(items)} synthetic findings across {len(set(x['repository'] for x in items))} repositories / {len(groups)} candidate root causes")
for k,v in groups.items():
 print(f"{k}: {', '.join(x['ticket'] for x in v)}; source={v[0]['source']}; group requires code review")
