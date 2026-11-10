import argparse,json,pathlib,struct,subprocess
p=argparse.ArgumentParser();p.add_argument('file');args=p.parse_args();path=pathlib.Path(args.file).resolve();b=path.read_bytes()
def boxes(start,end):
 while start<end:
  size,typ=struct.unpack_from('>I4s',b,start)
  assert size>=8 and start+size<=end
  yield typ,start,start+size
  start+=size
moov=next(x for x in boxes(0,len(b)) if x[0]==b'moov');headers=[]
def walk(start,end):
 for typ,a,z in boxes(start,end):
  if typ in [b'mvhd',b'mdhd',b'tkhd']:
   version=b[a+8];assert version==0
   duration=struct.unpack_from('>I',b,a+(28 if typ==b'tkhd' else 24))[0]
   assert duration!=0xffffffff
   scale=90000 if typ==b'tkhd' else struct.unpack_from('>I',b,a+20)[0]
   seconds=duration/scale;assert abs(seconds-470.952)<0.001
   headers.append({'box':typ.decode(),'seconds':seconds})
  if typ in [b'trak',b'mdia']:walk(a+8,z)
walk(moov[1]+8,moov[2])
assert len(headers)==5
ps="$s=New-Object -ComObject Shell.Application; $f=$s.Namespace('"+str(path.parent).replace("'","''")+"'); $x=$f.ParseName('"+path.name.replace("'","''")+"'); $x.ExtendedProperty('System.Media.Duration')"
r=subprocess.run(['powershell.exe','-NoProfile','-Command',ps],capture_output=True,text=True,check=True)
shell_seconds=int(r.stdout.strip())/10_000_000
assert abs(shell_seconds-470.952)<0.001
print(json.dumps({'headers':headers,'WindowsShellDurationSeconds':shell_seconds},indent=2))
