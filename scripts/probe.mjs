import {build} from 'esbuild';
await build({stdin:{contents:`import {Decrypter} from './vendor/h5e/decrypter.ts';import {MPEGTS} from './vendor/h5e/mpegts.ts';export {Decrypter,MPEGTS};`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:'artifacts/probe-lib.mjs',external:['node:*'],minify:false});
const {Decrypter,MPEGTS}=await import('../artifacts/probe-lib.mjs');
import {writeFile} from 'node:fs/promises';
const u='https://dh5qq01.v.cntv.cn/asp/h5e/hls/2000/0303000a/3/default/bbffcd957ed6453ca7ad6fca0bd4f9f2/2000.m3u8';
const text=await(await fetch(u)).text();
const urls=text.split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(x=>new URL(x,u).href);
const d=new Decrypter();await d.beginDecryptSession();
let raw=[],plain=[];
for(let i=0;i<Math.min(8,urls.length);i++) {const bytes=new Uint8Array(await(await fetch(urls[i])).arrayBuffer());raw.push(bytes.slice());plain.push(d.decryptTsBuffer(new MPEGTS(bytes)).dump());}
await writeFile('artifacts/raw.ts',Buffer.concat(raw));await writeFile('artifacts/plain.ts',Buffer.concat(plain));d.endDecryptSession();
