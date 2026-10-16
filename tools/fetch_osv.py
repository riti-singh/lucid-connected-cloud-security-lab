"""Fetch authoritative OSV JSON; requires network. No automatic CVE assertions."""
import argparse,datetime,json,urllib.request
from pathlib import Path
p=argparse.ArgumentParser()
g=p.add_mutually_exclusive_group(required=True)
g.add_argument('--id',help='OSV/GHSA vulnerability ID')
g.add_argument('--package',help='ecosystem:package-name, e.g. npm:lodash')
p.add_argument('--version',help='required when --package is used')
a=p.parse_args()
if a.package:
 if not a.version: p.error('--version required with --package')
 eco,pkg=a.package.split(':',1)
 url='https://api.osv.dev/v1/query'
 data=json.dumps({'version':a.version,'package':{'name':pkg,'ecosystem':eco}}).encode()
 req=urllib.request.Request(url,data=data,headers={'Content-Type':'application/json'})
else:
 url='https://api.osv.dev/v1/vulns/'+a.id
 req=urllib.request.Request(url)
with urllib.request.urlopen(req,timeout=20) as response: result=json.load(response)
out=Path(__file__).resolve().parents[1]/'data'/'advisories'/'osv-response.json'
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps({'retrieved_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'request':{'url':url,'package':a.package,'version':a.version,'id':a.id},'response':result},indent=2)+'\n')
print('Wrote source evidence:',out)
