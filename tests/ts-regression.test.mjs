import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('artifacts',{recursive:true});
await build({stdin:{contents:`export {Decrypter} from './vendor/h5e/decrypter.ts';export {MPEGTS} from './vendor/h5e/mpegts.ts';`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:'artifacts/probe-lib.mjs',external:['node:*'],logLevel:'silent'});
const {Decrypter,MPEGTS}=await import('../artifacts/probe-lib.mjs');
test('shrinking a NAL adds a flagged adaptation field and preserves 188-byte TS packets',()=>{
 const packet=new Uint8Array(188).fill(0x55);
 packet.set([0x47,0x41,0x00,0x10,0,0,1,0xe0,0,0,0x80,0,0,0,0,1,0x65]);
 const d=new Decrypter();
 // Isolate repacketization from cipher: emulate a valid one-byte NAL shrink.
 d.decryptNALU=n=>{n.payload=n.payload.subarray(0,n.payload.length-1);return n;};
 const ts=d.decryptTsBuffer(new MPEGTS(packet));
 assert.equal(ts.packets.filter(p=>p.adaptationField&&!p.header.hasAdaptationControl).length,0);
 assert.ok(ts.packets.every(p=>p.dump().length===188));
 const roundtrip=new MPEGTS(ts.dump());
 assert.ok(roundtrip.packets[0].header.hasAdaptationControl);
 assert.equal(roundtrip.packets[0].adaptationField.payloadLength,0);
});
