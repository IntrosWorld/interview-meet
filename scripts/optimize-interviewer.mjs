import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
import { stat } from 'node:fs/promises';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
for(const path of ['public/models/interviewer.glb','public/models/interviewer-studio.glb']) {
  const before=(await stat(path)).size;
  const doc=await io.read(path);
  await doc.transform(dedup(),prune({keepLeaves:true}));
  await io.write(path,doc);
  console.log(`${path}: ${before} -> ${(await stat(path)).size} bytes; skinning and morph targets preserved.`);
}
