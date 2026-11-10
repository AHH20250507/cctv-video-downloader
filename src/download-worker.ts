import { Decrypter } from '../vendor/h5e/decrypter.ts';
import { MPEGTS } from '../vendor/h5e/mpegts.ts';
import muxjs from 'mux.js';
let decryptor,transmuxer,first=true;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   decryptor=new Decrypter();await decryptor.beginDecryptSession();
   transmuxer=new muxjs.mp4.Transmuxer({keepOriginalTimestamps:false,remux:true});
   transmuxer.on('data',segment=>{
    if(segment.type!=='combined') throw new Error('未获得完整音视频轨道。');
    const parts=first?[segment.initSegment,segment.data]:[segment.data];first=false;
    for(const b of parts) self.postMessage({type:'part',buffer:b},[b.buffer]);
   });
   transmuxer.on('error',e=>{throw new Error(e.message||'MP4 封装失败');});
   self.postMessage({type:'ready'});
  }else if(data.type==='segment'){
   const plain=decryptor.decryptTsBuffer(new MPEGTS(data.buffer)).dump();
   transmuxer.push(plain);transmuxer.flush();
   self.postMessage({type:'processed',index:data.index});
  }else if(data.type==='finish'){
   decryptor.endDecryptSession();transmuxer.dispose();
   self.postMessage({type:'finished'});
  }
 }catch(e){self.postMessage({type:'error',message:e?.message||String(e)});}
};
