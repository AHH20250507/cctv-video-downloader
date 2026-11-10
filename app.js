import {parseInput,parseMaster,parseMedia} from './src/core.mjs';
const $=s=>document.querySelector(s);
const EXAMPLE='https://tv.cctv.com/2026/11/05/VIDEW9nYaP9C5dIzPQWfIYEV261105.shtml?spm=C53156045404.PKXC0xLPAnP9.0.0';
let info,variants,controller,worker,blobURL,busy=false;
function status(text,state='info'){$('#status').textContent=text;$('#status').dataset.state=state;}
function setBusy(value){busy=value;$('#parse').disabled=value;$('#url').disabled=value;$('#example').disabled=value;$('#download').disabled=value||!info;$('#quality').disabled=value;$('#cancel').hidden=!value;}
function progress(stage,value,detail){$('#progress-section').hidden=false;$('#stage').textContent=stage;$('#percent').textContent=`${Math.floor(value)}%`;$('#progress').value=value;$('#detail').textContent=detail;}
function jsonp(url,signal){return new Promise((resolve,reject)=>{
 const callback='cctv_'+crypto.randomUUID().replaceAll('-','');const script=document.createElement('script');let timer;
 const cleanup=()=>{clearTimeout(timer);script.remove();delete window[callback];signal?.removeEventListener('abort',abort);};
 const abort=()=>{cleanup();reject(new DOMException('已取消','AbortError'));};
 window[callback]=data=>{cleanup();resolve(data);};
 script.onerror=()=>{cleanup();reject(new Error('央视内容接口连接失败，请稍后重试，或直接输入视频 GUID。'));};
 timer=setTimeout(()=>{cleanup();reject(new Error('解析超时，请检查网络后重试。'));},20000);
 signal?.addEventListener('abort',abort,{once:true});script.src=url+'&cb='+callback;document.head.append(script);
});}
async function request(url,signal,kind='text'){
 let last;
 for(let attempt=0;attempt<3;attempt++){
  signal?.throwIfAborted();
  try{const response=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(25000)].filter(Boolean)),credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw new Error(`源站返回 HTTP ${response.status}`);return await response[kind]();}
  catch(e){last=e;if(signal?.aborted)throw e;if(attempt<2)await new Promise(r=>setTimeout(r,600*(attempt+1)));}
 }
 throw new Error(`无法读取央视视频资源（网络或跨域限制）。${last?.message||''}`);
}
function clearResult(){if(blobURL){URL.revokeObjectURL(blobURL);blobURL=null;}$('#preview').removeAttribute('src');$('#preview').load();$('#done').hidden=true;window.downloadResult=null;}
$('#example').onclick=()=>{$('#url').value=EXAMPLE;$('#url').focus();};
$('#cancel').onclick=()=>{controller?.abort();worker?.terminate();};
$('#form').onsubmit=async e=>{
 e.preventDefault();if(busy)return;clearResult();info=null;$('#result').hidden=true;$('#progress-section').hidden=true;
 controller=new AbortController();const signal=controller.signal;setBusy(true);status('正在读取央视视频信息…');
 try{
  const input=parseInput($('#url').value);let article;
  if(input.vid){const data=await jsonp('https://api.cntv.cn/Article/newContentInfo?serviceId=tvcctv&id='+encodeURIComponent(input.vid),signal);article=data.data;if(!/^[a-f0-9]{32}$/i.test(article?.guid||''))throw new Error('该页面未返回可下载的视频 GUID。');}
  const guid=input.guid||article.guid;
  const data=await request('https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do?pid='+guid,signal,'json');
  if(data.ack!=='yes'||data.is_protected==='1'||data.is_invalid_copyright==='1')throw new Error('该视频不可用或受版权 / 访问限制，无法下载。');
  const master=data.manifest?.hls_h5e_url;if(!master)throw new Error('该视频没有可支持的 h5e 码流；已停止，避免生成花屏文件。');
  const masterURL=new URL(master);masterURL.searchParams.delete('maxbr');
  variants=parseMaster(await request(masterURL.href,signal),masterURL.href);
  if(!variants.length)throw new Error('未能读取画质列表，无法可靠确认最高画质。');
  info={title:data.title||article?.title||guid,guid,duration:Number(data.video?.totalLength)||0};
  $('#title').textContent=info.title;$('#meta').textContent=`央视网 · ${Math.floor(info.duration/60)} 分 ${Math.round(info.duration%60)} 秒 · ${variants.length} 档画质`;
  $('#cover').src=data.image||article?.frame_url||'';
  $('#quality').replaceChildren(...variants.map((v,i)=>{const o=document.createElement('option');o.value=v.url;o.textContent=`${v.width} × ${v.height} · ${(v.bandwidth/1000000).toFixed(2)} Mbps${i===0?' · 最高画质':''}`;return o;}));
  $('#result').hidden=false;status('已默认选择源站最高画质。下载、码流处理和 MP4 封装都在本机完成。');
 }catch(e){status(signal.aborted?'已取消解析。':e.message,'error');}finally{setBusy(false);}
};
async function verifyVideo(blob,expected){
 const video=document.createElement('video');video.muted=true;video.preload='auto';const url=URL.createObjectURL(blob);
 try{
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('MP4 播放检查超时。')),20000);video.onloadeddata=()=>{clearTimeout(t);resolve();};video.onerror=()=>{clearTimeout(t);reject(new Error('浏览器无法解码输出视频，未提供下载。'));};video.src=url;});
  if(!video.videoWidth||!video.videoHeight||!Number.isFinite(video.duration)||video.duration<expected-3)throw new Error('输出视频时长或画面轨道不完整，未提供下载。');
  return {width:video.videoWidth,height:video.videoHeight,duration:video.duration};
 }finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}
$('#download').onclick=async()=>{
 if(busy||!info)return;clearResult();controller=new AbortController();const signal=controller.signal;setBusy(true);status('正在处理，保持页面打开。');
 let parts=[],bytes=0,waiter;
 const wait=type=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('码流处理超时，请重试。')),45000);waiter={type,resolve:()=>{clearTimeout(timer);resolve();},reject:e=>{clearTimeout(timer);reject(e);}};});
 const abort=()=>waiter?.reject(new DOMException('已取消','AbortError'));
 signal.addEventListener('abort',abort);
 try{
  const selected=variants.find(v=>v.url===$('#quality').value);
  const {segments,duration}=parseMedia(await request(selected.url,signal),selected.url);
  if(duration*selected.bandwidth/8>800*1024*1024)throw new Error('预计文件超过 800 MB，当前内存模式不适合该长视频。请选择较低码率，或使用桌面下载工具。');
  worker=new Worker(new URL('./download-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
   if(data.type==='part'){bytes+=data.buffer.byteLength;if(bytes>800*1024*1024){waiter?.reject(new Error('文件已超过 800 MB 内存保护限制。'));return;}parts.push(data.buffer);}
   else if(data.type==='error')waiter?.reject(new Error('码流处理失败：'+data.message));
   else if(data.type===waiter?.type)waiter.resolve();
  };
  worker.onerror=e=>waiter?.reject(new Error('处理模块加载失败：'+e.message));
  const ready=wait('ready');worker.postMessage({type:'init'});await ready;
  // Sequential processing preserves decoder session state and limits memory.
  for(let i=0;i<segments.length;i++){
   signal.throwIfAborted();progress('下载并处理视频',i/segments.length*98,`${i} / ${segments.length} 个分片 · 已封装 ${(bytes/1024/1024).toFixed(1)} MB`);
   const buffer=new Uint8Array(await request(segments[i],signal,'arrayBuffer'));
   if(buffer.byteLength<188||buffer[0]!==0x47)throw new Error('源站返回的不是有效 TS 分片，已停止。');
   const done=wait('processed');worker.postMessage({type:'segment',index:i,buffer},[buffer.buffer]);await done;
  }
  const finished=wait('finished');worker.postMessage({type:'finish'});await finished;signal.throwIfAborted();
  progress('检查 MP4 播放能力',99,'正在确认音视频封装及实际分辨率…');
  if(!parts.length)throw new Error('没有生成音视频数据。');
  const blob=new Blob(parts,{type:'video/mp4'});parts=[];
  const checked=await verifyVideo(blob,duration);signal.throwIfAborted();
  if(checked.width!==selected.width||checked.height!==selected.height)throw new Error('实际分辨率与所选画质不一致，已停止输出。');
  window.downloadResult={blob,...checked};blobURL=URL.createObjectURL(blob);
  $('#save').href=blobURL;$('#save').download=info.title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,150)+'.mp4';
  $('#preview').src=blobURL;$('#summary').textContent=`${checked.width} × ${checked.height} · ${(blob.size/1024/1024).toFixed(1)} MB · MP4 / H.264 + AAC`;
  $('#done').hidden=false;progress('处理完成',100,`${segments.length} 个分片已完成 · 未重新压缩`);status('MP4 已生成并通过浏览器首帧解码检查。请播放预览确认画面后保存。','success');
 }catch(e){clearResult();status(signal.aborted?'已取消下载，未生成不完整文件。':e.message,'error');}
 finally{parts=[];signal.removeEventListener('abort',abort);worker?.terminate();worker=null;setBusy(false);}
};
