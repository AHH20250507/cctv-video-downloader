export function parseMedia(text, base) {
  if(!text.trimStart().startsWith('#EXTM3U') || !text.includes('#EXT-X-ENDLIST')) throw new Error('只支持完整点播视频，不支持直播或未完成的播放列表。');
  if (/#EXT-X-KEY:.*METHOD=(?!NONE)/.test(text) || /#EXT-X-(BYTERANGE|MAP|DISCONTINUITY)/.test(text)) throw new Error('该视频使用了暂不支持的分片或加密格式，已停止，避免输出花屏文件。');
  const lines=text.split(/\r?\n/).map(x=>x.trim());
  const segments=lines.filter(x=>x&&!x.startsWith('#')).map(x=>new URL(x,base).href);
  if(!segments.length) throw new Error('播放列表没有视频分片。');
  const duration=lines.reduce((n,l)=>n+(l.startsWith('#EXTINF:')?Number(l.slice(8).split(',')[0]):0),0);
  return {segments,duration};
}
export function parseMaster(text, base) {
  if (!text.trimStart().startsWith('#EXTM3U')) throw new Error('服务器未返回有效的 HLS 播放列表。');
  const lines = text.split(/\r?\n/).map(x=>x.trim());
  const variants=[];
  for(let i=0;i<lines.length;i++) if(lines[i].startsWith('#EXT-X-STREAM-INF:')) {
    const resolution=lines[i].match(/RESOLUTION=(\d+)x(\d+)/);
    const bandwidth=Number(lines[i].match(/(?:^|[:, ])BANDWIDTH=(\d+)/)?.[1]||0);
    let j=i+1; while(j<lines.length && (!lines[j]||lines[j].startsWith('#'))) j++;
    if(j<lines.length) variants.push({url:new URL(lines[j],base).href,width:Number(resolution?.[1]||0),height:Number(resolution?.[2]||0),bandwidth});
  }
  return variants.sort((a,b)=>b.width*b.height-a.width*a.height||b.bandwidth-a.bandwidth);
}
export function parseInput(text) {
  text = text.trim();
  if (/^[a-f0-9]{32}$/i.test(text)) return {guid:text};
  let url;
  try { url = new URL(text); } catch { throw new Error('请粘贴完整的央视网视频链接，或 32 位 GUID。'); }
  if (!['https:','http:'].includes(url.protocol) || !/(^|\.)cctv\.com$/.test(url.hostname) || url.username || url.password) throw new Error('仅支持 cctv.com 旗下的央视网视频链接。');
  const vid = url.pathname.match(/\/(VIDE[A-Za-z0-9]+)\.shtml$/)?.[1];
  if (!vid) throw new Error('未找到视频编号。请使用单条视频的 .shtml 页面链接。');
  return {vid};
}
