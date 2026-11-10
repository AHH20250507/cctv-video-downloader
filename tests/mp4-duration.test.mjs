import test from 'node:test';
import assert from 'node:assert/strict';
import muxjs from 'mux.js';
const module=await import('../src/mp4-duration.mjs').catch(()=>null);
function children(bytes,start=0,end=bytes.length){const a=[];const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(let p=start;p<end;){const size=v.getUint32(p);a.push({type:String.fromCharCode(...bytes.subarray(p+4,p+8)),p,size});p+=size;}return a;}
function inspect(bytes){const moov=children(bytes).find(x=>x.type==='moov');const tree=children(bytes,moov.p+8,moov.p+moov.size);const movie=tree.find(x=>x.type==='mvhd');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);const values=[{kind:'mvhd',scale:view.getUint32(movie.p+20),duration:view.getUint32(movie.p+24)}];for(const trak of tree.filter(x=>x.type==='trak')){const boxes=children(bytes,trak.p+8,trak.p+trak.size);const tkhd=boxes.find(x=>x.type==='tkhd');values.push({kind:'tkhd',scale:values[0].scale,duration:view.getUint32(tkhd.p+28)});const mdia=boxes.find(x=>x.type==='mdia');const mdhd=children(bytes,mdia.p+8,mdia.p+mdia.size).find(x=>x.type==='mdhd');values.push({kind:'mdhd',scale:view.getUint32(mdhd.p+20),duration:view.getUint32(mdhd.p+24)});}return values;}
const init=muxjs.mp4.generator.initSegment([{id:1,type:'video',duration:0xffffffff,width:1280,height:720,sps:[new Uint8Array([0x67,0x42,0,0x1f])],pps:[new Uint8Array([0x68,0xce,6,0xe2])],profileIdc:66,profileCompatibility:0,levelIdc:31},{id:2,type:'audio',duration:0xffffffff,samplerate:48000,channelcount:2,samplesize:16,audioobjecttype:2,samplingfrequencyindex:3}]);
test('rejects invalid durations and malformed metadata instead of corrupting output',()=>{
 assert.equal(typeof module?.finalizeMp4Duration,'function');
 for(const value of [0,-1,NaN,Infinity,50000])assert.throws(()=>module.finalizeMp4Duration(init,value));
 assert.throws(()=>module.finalizeMp4Duration(init.subarray(0,30),470));
 assert.throws(()=>module.finalizeMp4Duration(new Uint8Array(8),470));
});

test('finalizes movie and track durations in each header timescale without changing media',()=>{
 assert.equal(typeof module?.finalizeMp4Duration,'function','duration finalizer must exist');
 const before=init.slice();const fixed=module.finalizeMp4Duration(init,470.952);
 assert.deepEqual(init,before,'does not mutate original');assert.equal(fixed.length,init.length);
 for(const item of inspect(fixed))assert.ok(Math.abs(item.duration/item.scale-470.952)<1/item.scale,JSON.stringify(item));
});
