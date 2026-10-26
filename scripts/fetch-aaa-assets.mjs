import { mkdir,readFile,writeFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder='F:/AI_models/interview-meet/aaa';
const url='https://raw.githubusercontent.com/met4citizen/TalkingHead/46b32ee539c41eb7c6b41fcfc74ae030d1b800a7/avatars/avatarsdk.glb';
const sha='193c07c351f1f94b12b499ece3f8813432dbe902afe0b5dd6957e788a9a36605';
await mkdir(folder,{recursive:true});
let data=await readFile(folder+'/avatarsdk-reference.glb').catch(()=>null);
if(!data||createHash('sha256').update(data).digest('hex')!==sha){
  console.log('Downloading non-commercial AvatarSDK evaluation asset to F: (not for production redistribution).');
  const response=await fetch(url);if(!response.ok)throw Error('Asset download failed');
  data=Buffer.from(await response.arrayBuffer());
  if(createHash('sha256').update(data).digest('hex')!==sha)throw Error('Asset checksum mismatch');
  await writeFile(folder+'/avatarsdk-reference.glb',data);
}
console.log('Verified local reference asset on F:. Upstream non-commercial-use terms apply.');
