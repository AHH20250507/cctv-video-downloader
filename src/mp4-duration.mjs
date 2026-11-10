// mux.js writes 0xffffffff ('unknown') into fMP4 duration headers.
// Players scan fragments, but Windows Shell displays that sentinel as 13:15:21.
// Finalize only fixed-size duration fields; fragment offsets/media stay intact.
export function finalizeMp4Duration(input, seconds) {
  if (!(input instanceof Uint8Array) || !Number.isFinite(seconds) || seconds <= 0) throw new Error('无效的 MP4 时长。');
  const bytes=input.slice();
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  function boxes(start,end) {
    const found=[];
    for(let p=start;p<end;){
      if(p+8>end) throw new Error('MP4 元数据不完整。');
      const size=view.getUint32(p);
      if(size<8||p+size>end) throw new Error('不支持的 MP4 元数据结构。');
      found.push({type:String.fromCharCode(...bytes.subarray(p+4,p+8)),p,end:p+size});p+=size;
    }
    return found;
  }
  function field(box,kind) {
    const version=bytes[box.p+8];
    if(version!==0&&version!==1) throw new Error('不支持的 MP4 时长版本。');
    const offset=box.p+(kind==='tkhd'?(version===1?36:28):(version===1?32:24));
    if(offset+(version===1?8:4)>box.end) throw new Error('MP4 时长字段不完整。');
    return {offset,version};
  }
  function scale(box) {
    field(box,box.type);
    const value=view.getUint32(box.p+(bytes[box.p+8]===1?28:20));
    if(!value)throw new Error('MP4 时间基准无效。');
    return value;
  }
  function write(box,timescale) {
    const {offset,version}=field(box,box.type);
    const ticks=Math.round(seconds*timescale);
    if(!Number.isSafeInteger(ticks)||(!version&&ticks>=0xffffffff))throw new Error('视频时长超出当前 MP4 封装范围。');
    if(version===1)view.setBigUint64(offset,BigInt(ticks));else view.setUint32(offset,ticks);
  }
  const moov=boxes(0,bytes.length).find(b=>b.type==='moov');
  if(!moov)throw new Error('MP4 缺少影片元数据。');
  const movieBoxes=boxes(moov.p+8,moov.end);
  const mvhd=movieBoxes.find(b=>b.type==='mvhd');
  if(!mvhd)throw new Error('MP4 缺少影片时长。');
  const movieScale=scale(mvhd);write(mvhd,movieScale);
  const tracks=movieBoxes.filter(b=>b.type==='trak');
  if(!tracks.length)throw new Error('MP4 缺少音视频轨道。');
  for(const track of tracks){
    const trackBoxes=boxes(track.p+8,track.end);
    const tkhd=trackBoxes.find(b=>b.type==='tkhd');
    const mdia=trackBoxes.find(b=>b.type==='mdia');
    if(!tkhd||!mdia)throw new Error('MP4 轨道元数据不完整。');
    const mdhd=boxes(mdia.p+8,mdia.end).find(b=>b.type==='mdhd');
    if(!mdhd)throw new Error('MP4 缺少媒体时长。');
    write(tkhd,movieScale);write(mdhd,scale(mdhd));
  }
  return bytes;
}
