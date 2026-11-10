import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('page provides local SVG, ICO and touch icons and deploys them',async()=>{
 const html=await readFile('index.html','utf8');
 assert.match(html,/rel="icon"[^>]+href="favicon\.svg\?v=1"/);
 assert.match(html,/rel="icon"[^>]+href="favicon\.ico\?v=1"/);
 assert.match(html,/rel="apple-touch-icon"[^>]+href="apple-touch-icon\.png\?v=1"/);
 assert.match(await readFile('favicon.svg','utf8'),/<svg/);
 const ico=await readFile('favicon.ico');assert.equal(ico.readUInt16LE(2),1);assert.ok(ico.readUInt16LE(4)>=3);
 const png=await readFile('apple-touch-icon.png');assert.equal(png.readUInt32BE(16),180);assert.equal(png.readUInt32BE(20),180);
 const workflow=await readFile('.github/workflows/pages.yml','utf8');
 for(const asset of ['favicon.svg','favicon.ico','apple-touch-icon.png'])assert.ok(workflow.includes(asset));
});
