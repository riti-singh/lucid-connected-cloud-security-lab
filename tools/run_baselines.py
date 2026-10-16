import argparse,shutil,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
LANGS=['python','typescript','java','go']
ap=argparse.ArgumentParser(description='Default (no flags): baseline mode, security tests must FAIL and compiles must PASS.')
mode=ap.add_mutually_exclusive_group()
mode.add_argument('--expect-fixed',action='store_true',help='every job must PASS (all four languages fixed)')
mode.add_argument('--fixed',action='append',choices=LANGS,default=[],metavar='LANG',help=f"repeatable; LANG ({', '.join(LANGS)}) security tests must PASS, all others must still FAIL as baseline")
opts=ap.parse_args()
fixed=opts.expect_fixed
fixed_langs=set(LANGS) if fixed else set(opts.fixed)
# (name, language, cwd, command, required tools, prerequisite job, artifact the prerequisite must produce, generated dir cleared before running)
jobs=[
 ('Python','python',root/'repos/diagnostics-document-api',['python3','-m','unittest','discover','-s','tests','-v'],['python3'],None,None,None),
 ('TypeScript compile','typescript',root/'repos/charging-session-api',['tsc','-p','tsconfig.json'],['tsc'],None,None,'dist'),
 ('TypeScript tests','typescript',root/'repos/charging-session-api',['node','dist/charging.test.js'],['node'],'TypeScript compile','dist/charging.test.js',None),
 ('Java compile','java',root/'repos/ota-release-gateway',['bash','-c','mkdir -p build && javac -d build src/*.java'],['bash','javac'],None,None,'build'),
 ('Java tests','java',root/'repos/ota-release-gateway',['java','-cp','build','OtaReleaseTests'],['java'],'Java compile','build/OtaReleaseTests.class',None),
 ('Go','go',root/'repos/telemetry-exporter',['go','test','./...','-v'],['go'],None,None,None)]
fail=False;errors=0;ran=set()
for name,lang,cwd,args,tools,prereq,artifact,clean in jobs:
 missing=[t for t in tools if shutil.which(t) is None]
 if missing:
  print(f"ERROR {name}: required toolchain not found on PATH: {', '.join(missing)}");fail=True;errors+=1;continue
 if prereq and prereq not in ran:
  print(f"ERROR {name}: prerequisite '{prereq}' did not run");fail=True;errors+=1;continue
 if artifact and not (cwd/artifact).exists():
  print(f"ERROR {name}: '{prereq}' did not produce {artifact}");fail=True;errors+=1;continue
 if clean: shutil.rmtree(cwd/clean,ignore_errors=True)
 try: p=subprocess.run(args,cwd=cwd,capture_output=True,text=True,timeout=35)
 except (FileNotFoundError,subprocess.TimeoutExpired) as e:
  print(f'ERROR {name}: {e}');fail=True;errors+=1;continue
 ran.add(name)
 ok=(p.returncode==0)
 target=True if name.endswith(' compile') else lang in fixed_langs
 print(f"{name}: {'PASS' if ok else 'FAIL'}; expected {'PASS' if target else 'FAIL'}; {'MATCH' if ok==target else 'MISMATCH'}")
 if ok!=target:
  fail=True; print((p.stdout+p.stderr)[-1500:])
if errors:
 print(f'ERROR {errors} job(s) could not run; results are not a valid baseline');sys.exit(2)
if fail: sys.exit(1)
if fixed or fixed_langs==set(LANGS): print('PASS all remediations verified')
elif fixed_langs: print(f"PASS remediations verified for {', '.join(l for l in LANGS if l in fixed_langs)}; baseline weaknesses remain for {', '.join(l for l in LANGS if l not in fixed_langs)}")
else: print('PASS all expected outcomes; baseline weaknesses remain')
