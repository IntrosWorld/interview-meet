import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const children = [];
const env = { ...process.env, LOCAL_MODEL_DIR: process.env.LOCAL_MODEL_DIR || 'F:/AI_models/interview-meet' };
if (!/^F:[/\\]/i.test(env.LOCAL_MODEL_DIR)) throw new Error('Keep LOCAL_MODEL_DIR on F:');
const python = spawn(process.env.LOCAL_PYTHON || 'python', ['scripts/local-speech.py'], { env, stdio: 'inherit', windowsHide: true });
children.push(python);
python.on('error', () => console.error('Python unavailable. Typed chat still works. Set LOCAL_PYTHON to a Python with faster-whisper installed.'));
const node = spawn(process.execPath, [require.resolve('tsx/cli'), 'src/local-server.ts'], { env, stdio: 'inherit', windowsHide: true });
children.push(node);
function stop() { for (const child of children) child.kill(); }
node.on('exit', code => { stop(); process.exitCode = code || 0; });
process.on('SIGINT', stop); process.on('SIGTERM', stop);
