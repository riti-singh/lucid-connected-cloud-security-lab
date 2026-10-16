import subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
fixed='--expect-fixed' in sys.argv
jobs=[
 ('Python',root/'repos/diagnostics-document-api',['python3','-m','unittest','discover','-s','tests','-v']),
 ('TypeScript compile',root/'repos/charging-session-api',['tsc','-p','tsconfig.json']),
 ('TypeScript tests',root/'repos/charging-session-api',['node','dist/charging.test.js']),
 ('Java compile',root/'repos/ota-release-gateway',['bash','-c','mkdir -p build && javac -d build src/*.java']),
 ('Java tests',root/'repos/ota-release-gateway',['java','-cp','build','OtaReleaseTests']),
 ('Go',root/'repos/telemetry-exporter',['go','test','./...','-v'])]
expected={'Python':False,'TypeScript compile':True,'TypeScript tests':False,'Java compile':True,'Java tests':False,'Go':False}
fail=False
for name,cwd,args in jobs:
 try: p=subprocess.run(args,cwd=cwd,capture_output=True,text=True,timeout=35)
 except (FileNotFoundError,subprocess.TimeoutExpired) as e:
  print('ERROR',name,e);fail=True;continue
 ok=(p.returncode==0)
 target=True if fixed else expected[name]
 print(f"{name}: {'PASS' if ok else 'FAIL'}; expected {'PASS' if target else 'FAIL'}; {'MATCH' if ok==target else 'MISMATCH'}")
 if ok!=target:
  fail=True; print((p.stdout+p.stderr)[-1500:])
if fail: sys.exit(1)
print('PASS all expected outcomes; baseline weaknesses remain' if not fixed else 'PASS all remediations verified')
