import { build } from 'esbuild';
await build({entryPoints:['src/client/interviewer.js'],outfile:'public/interviewer.bundle.js',bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'linked'});
