import { createServer } from 'node:http';
createServer(async (req, res) => {
  if (req.url === '/api/tags') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] })); }
  let body = ''; for await (const chunk of req) body += chunk;
  const input = JSON.parse(body), last = input.messages.at(-1).content;
  if (last === 'fail') { res.statusCode = 503; return res.end(); }
  res.setHeader('Content-Type', 'application/x-ndjson');
  const parts = [`I received ${input.messages.length - 1} turns. `, `You said: ${last}. `, 'What did you learn?'];
  let i = 0;
  const timer = setInterval(() => {
    if (last === 'long' || i < parts.length) {
      res.write(JSON.stringify({ message: { content: last === 'long' ? 'more ' : parts[i++] }, done: false }) + '\n');
    } else { clearInterval(timer); res.end(JSON.stringify({ done: true, eval_count: 20, eval_duration: 1e9 }) + '\n'); }
  }, 100);
  res.on('close', () => clearInterval(timer));
}).listen(11435, '127.0.0.1');
