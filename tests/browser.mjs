import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile,mkdir } from 'node:fs/promises';
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:8768');
 await page.locator('#url').fill('https://tv.cctv.com/2026/11/05/VIDEW9nYaP9C5dIzPQWfIYEV261105.shtml?spm=C53156045404.PKXC0xLPAnP9.0.0');
 await page.locator('#parse').click();
 await page.waitForFunction(()=>document.querySelector('#download')?.disabled===false,null,{timeout:60000});
 assert.match(await page.locator('#quality').inputValue(),/2000/);
 await page.locator('#download').click();
 await page.waitForFunction(()=>window.downloadResult||document.querySelector('#status')?.dataset.state==='error',null,{timeout:480000});
 const state=await page.locator('#status').innerText();
 assert.ok(await page.evaluate(()=>!!window.downloadResult),state);
 const result=await page.evaluate(async()=>{
  const r=window.downloadResult;
  const chunks=[];const b=new Uint8Array(await r.blob.arrayBuffer());
  // Transfer in chunks, not one enormous JSON response.
  window.testBytes=b;
  return {size:b.length,duration:r.duration,width:r.width,height:r.height};
 });
 await mkdir('artifacts',{recursive:true});
 const chunks=[];
 for(let i=0;i<result.size;i+=64*1024) chunks.push(Buffer.from(await page.evaluate(([a,b])=>btoa(String.fromCharCode(...window.testBytes.subarray(a,b))),[i,Math.min(i+64*1024,result.size)]),'base64'));
 await writeFile('artifacts/test-video.mp4',Buffer.concat(chunks));
 await writeFile('artifacts/result.json',JSON.stringify({url:page.url(),...result,state},null,2));
 await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
 console.log(JSON.stringify(result));
} finally { await browser.close(); }
