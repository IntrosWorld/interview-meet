import { performance } from 'node:perf_hooks';
const base = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
for (const model of process.argv.slice(2).length ? process.argv.slice(2) : ['qwen3:1.7b', 'granite3.3:2b', 'llama3.2:3b']) {
  for (const round of ['cold', 'warm']) {
    const start = performance.now(); let first, text = '', final;
    const response = await fetch(base + '/api/chat', { method: 'POST', signal: AbortSignal.timeout(120000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      model, think: false, stream: true, keep_alive: '2m',
      messages: [{ role: 'system', content: 'You are a concise interview partner. Reply in at most two short sentences and ask exactly one follow-up question. No markdown.' },
        { role: 'user', content: 'I am practicing for a backend developer interview. My last project was a REST API for a college library. Start our conversation.' }],
      options: { num_ctx: 2048, num_predict: 90, temperature: .4 }
    }) });
    if (!response.ok) { console.log(JSON.stringify({ model, round, error: response.status })); continue; }
    let buffer = '';
    for await (const chunk of response.body) {
      buffer += new TextDecoder().decode(chunk);
      let line;
      while ((line = buffer.indexOf('\n')) !== -1) {
        const item = JSON.parse(buffer.slice(0, line)); buffer = buffer.slice(line + 1);
        if (item.message?.content) { first ??= performance.now() - start; text += item.message.content; }
        if (item.done) final = item;
      }
    }
    console.log(JSON.stringify({ model, round, firstTokenMs: Math.round(first || 0), totalMs: Math.round(performance.now() - start), tokensPerSecond: final?.eval_duration ? +(final.eval_count / (final.eval_duration / 1e9)).toFixed(1) : null, text }));
  }
}
