import {build} from 'esbuild';
await build({entryPoints:['src/download-worker.ts'],outfile:'download-worker.js',bundle:true,format:'esm',platform:'browser',external:['node:*'],minify:true,legalComments:'eof'});
console.log('Built browser worker');
