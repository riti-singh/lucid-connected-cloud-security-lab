"""Export each synthetic service and the control plane into five standalone Git-ready folders."""
from pathlib import Path
import shutil
import argparse
p=argparse.ArgumentParser()
p.add_argument('--output',default='/tmp/connected-cloud-export')
a=p.parse_args()
root=Path(__file__).resolve().parents[1]
out=Path(a.output).expanduser().resolve()
if out==root or root in out.parents: raise SystemExit('Choose output outside this workspace')
out.mkdir(parents=True,exist_ok=True)
for src in sorted((root/'repos').iterdir()):
 if not src.is_dir(): continue
 dest=out/('connected-cloud-'+src.name)
 if dest.exists(): raise SystemExit(f'Refusing to overwrite {dest}')
 shutil.copytree(src,dest,ignore=shutil.ignore_patterns('build','dist','__pycache__','*.pyc'))
 (dest/'.gitignore').write_text('build/\ndist/\n__pycache__/\n*.pyc\nnode_modules/\n')
 print(dest)
control=out/'connected-cloud-security-control'
if control.exists(): raise SystemExit(f'Refusing to overwrite {control}')
control.mkdir()
for name in ('data','docs','devin','tools'):
 shutil.copytree(root/name,control/name,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
(control/'README.md').write_text('# Security control plane\nSynthetic Jira-style finding records, Devin workflows and evidence tooling. Baseline runner requires services to be assembled in the original workspace.\n')
print(control)
