import test from 'node:test';
import assert from 'node:assert/strict';
const core = await import('../src/core.mjs').catch(()=>null);
test('media playlist preserves segment order and rejects live and AES streams', () => {
 const text='#EXTM3U\n#EXTINF:10,\na.ts\n#EXTINF:2.5,\nb.ts\n#EXT-X-ENDLIST';
 assert.deepEqual(core.parseMedia?.(text,'https://dh5qq01.v.cntv.cn/a/x.m3u8'),{segments:['https://dh5qq01.v.cntv.cn/a/a.ts','https://dh5qq01.v.cntv.cn/a/b.ts'],duration:12.5});
 assert.throws(()=>core.parseMedia(text.replace('#EXT-X-ENDLIST',''),'https://example.com/a.m3u8'));
 assert.throws(()=>core.parseMedia('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXT-X-ENDLIST','https://example.com/a.m3u8'));
});
test('master playlist selects highest resolution then bitrate, not list order', () => {
  const text='#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2048000,RESOLUTION=1280x720\n2000.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=1228800,RESOLUTION=1280x720\n1200.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=870400,RESOLUTION=640x360\n850.m3u8';
  assert.equal(core?.parseMaster?.(text,'https://dh5qq01.v.cntv.cn/a/main.m3u8')?.[0]?.url, 'https://dh5qq01.v.cntv.cn/a/2000.m3u8');
});
test('accepts CCTV article URLs and GUIDs, rejects lookalike hosts', () => {
  assert.ok(core, 'core module must exist');
  assert.deepEqual(core.parseInput('https://tv.cctv.com/2026/11/05/VIDEW9nYaP9C5dIzPQWfIYEV261105.shtml?spm=x'), {vid:'VIDEW9nYaP9C5dIzPQWfIYEV261105'});
  assert.deepEqual(core.parseInput('bbffcd957ed6453ca7ad6fca0bd4f9f2'), {guid:'bbffcd957ed6453ca7ad6fca0bd4f9f2'});
  for(const x of ['https://tv.cctv.com.evil.com/a.shtml','http://127.0.0.1/a','not-a-url']) assert.throws(()=>core.parseInput(x));
});
