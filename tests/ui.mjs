import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:8768');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile page must not overflow');
 assert.deepEqual(await page.evaluate(()=>({
  example:document.querySelectorAll('#example').length,
  explanation:[...document.querySelectorAll('details')].filter(el=>el.textContent.includes('为什么普通下载器可能花屏？')).length,
  source:[...document.querySelectorAll('a')].filter(el=>el.textContent.includes('源代码')).length,
 })),{example:0,explanation:0,source:0},'removed test link, explanation section and source link must not exist');
 await page.locator('#url').fill('https://tv.cctv.com.evil.com/VIDE123.shtml');await page.locator('#parse').click();
 await page.waitForFunction(()=>document.querySelector('#status').dataset.state==='error');
 assert.equal(await page.locator('#result').isVisible(),false);
 // Hold the real JSONP request so parsing remains in flight until cancelled.
 let pendingArticle;
 const articleRoute='https://api.cntv.cn/Article/newContentInfo?*';
 await page.route(articleRoute,route=>{pendingArticle=route;});
 await page.locator('#url').fill('https://tv.cctv.com/2026/11/05/VIDEW9nYaP9C5dIzPQWfIYEV261105.shtml?spm=C53156045404.PKXC0xLPAnP9.0.0');
 const articleRequest=page.waitForRequest(url=>url.url().startsWith('https://api.cntv.cn/Article/newContentInfo?'));
 await page.locator('#parse').click();await articleRequest;
 assert.equal(await page.locator('#result').isVisible(),false);
 assert.equal(await page.locator('#cancel').count(),1,'one cancel control serves parsing and downloading');
 assert.equal(await page.locator('#cancel').isVisible(),true,'cancel must be visible while parsing with the result hidden');
 await page.locator('#cancel').click();
 await page.waitForFunction(()=>document.querySelector('#parse').disabled===false);
 assert.match(await page.locator('#status').innerText(),/已取消解析/);
 assert.equal(await page.locator('#cancel').isVisible(),false);
 assert.equal(await page.locator('#url').isEnabled(),true);
 assert.equal(await page.locator('#done').isVisible(),false);
 assert.equal(await page.evaluate(()=>document.querySelectorAll('script[src^="https://api.cntv.cn/Article/newContentInfo"]').length),0,'cancel removes the pending JSONP script');
 if(pendingArticle)await pendingArticle.abort().catch(()=>{});
 await page.unroute(articleRoute);
 // Retry after cancellation using the real endpoint, then retain download cancellation coverage.
 await page.locator('#parse').click();
 await page.waitForFunction(()=>document.querySelector('#download').disabled===false,null,{timeout:60000});
 assert.equal(await page.locator('#cancel').isVisible(),false);
 await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
 await page.locator('#download').click();await page.locator('#cancel').click();
 await page.waitForFunction(()=>document.querySelector('#parse').disabled===false,null,{timeout:45000});
 assert.match(await page.locator('#status').innerText(),/已取消下载/);
 assert.equal(await page.locator('#cancel').isVisible(),false);
 assert.equal(await page.locator('#download').isEnabled(),true);
 assert.equal(await page.locator('#done').isVisible(),false);
 assert.equal(await page.evaluate(()=>window.downloadResult==null),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: mobile layout, invalid URL, visible parse cancel, parse cancellation cleanup, real parsing retry, download cancel, no partial file, no page errors');
}finally{await browser.close();}
