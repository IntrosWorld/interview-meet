// Prepare the textured Avaturn demo character for the same studio as the male.
// Upstream permits non-commercial use; see public/models/ATTRIBUTION.md.
// Run: node scripts/build-female-avatar.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, getBounds } from '@gltf-transform/functions';
import { Matrix4, Quaternion, Vector3 } from 'three';

const revision = '8c3fe13df098fac1ad62bb61972a404d2827ba54';
const source = `https://raw.githubusercontent.com/met4citizen/TalkingHead/${revision}/avatars/avaturn.glb`;
const checksum = 'f56e7a34e249597cff08ba7ef7ce597b61b66b455a21023f186e769caca0cdda';
const cache = 'F:/AI_models/interview-meet/female/avaturn.glb';
await mkdir('F:/AI_models/interview-meet/female', { recursive: true });
let bytes = await readFile(cache).catch(() => null);
if (!bytes || createHash('sha256').update(bytes).digest('hex') !== checksum) {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Female avatar download failed: ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== checksum) throw new Error('Female avatar checksum mismatch');
  await writeFile(cache, bytes);
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(cache);
const scene = doc.getRoot().listScenes()[0];
const nodes = doc.getRoot().listNodes();
const head = nodes.find(n => n.getName() === 'Head');
if (!head) throw new Error('Female character has no Head joint');
// Match the male character's head pivot, keeping face size and eye-line consistent.
const scale = 1.5758253358156735 / head.getWorldTranslation()[1];
const bounds = getBounds(scene);
const wrapper = doc.createNode('Female interviewer · studio fit')
  .setScale([scale, scale, scale])
  .setTranslation([0, -bounds.min[1] * scale, .026]);
for (const child of scene.listChildren()) { scene.removeChild(child); wrapper.addChild(child); }
scene.addChild(wrapper);

// Pose the existing skinned arms down instead of shipping the reference T-pose.
for (const [name, angle] of [['LeftArm', -1.1], ['RightArm', 1.1]]) {
  const bone = nodes.find(n => n.getName() === name);
  if (!bone) continue;
  const parent = bone.getParentNode();
  const parentQ = new Quaternion(), currentQ = new Quaternion();
  new Matrix4().fromArray(parent.getWorldMatrix()).decompose(new Vector3(), parentQ, new Vector3());
  new Matrix4().fromArray(bone.getWorldMatrix()).decompose(new Vector3(), currentQ, new Vector3());
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle);
  bone.setRotation(parentQ.invert().multiply(rotation).multiply(currentQ).toArray());
}
for (const mesh of doc.getRoot().listMeshes()) {
  const names = mesh.getExtras().targetNames || [];
  if (names.length) mesh.setWeights(names.map(() => 0));
}
for (const material of doc.getRoot().listMaterials()) {
  if (material.getName() === 'Head') material.setRoughnessFactor(.65);
  if (material.getName() === 'Eyes') material.setRoughnessFactor(.2);
  if (material.getName().startsWith('avaturn_look')) material.setRoughnessFactor(.85);
}
doc.getRoot().setExtras({
  source, sourceSha256: checksum,
  license: 'Avaturn example for non-commercial use; see ATTRIBUTION.md',
  modifications: 'Studio fit, relaxed arms, neutral morph weights, material roughness, dedup/prune.'
});
await doc.transform(dedup(), prune({ keepLeaves: true }));
const output = 'public/models/interviewer-female.glb';
await io.write(output, doc);
console.log(`Created ${output}; textured female character with skinning and facial morphs preserved.`);
