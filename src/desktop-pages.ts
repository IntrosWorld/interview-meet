import { readFile } from 'node:fs/promises';

// Use the web page markup and design system; only replace its cloud controller.
export async function desktopPage(coding = false) {
  let html = await readFile(`public/${coding ? 'coding' : 'index'}.html`, 'utf8');
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  html = html.replace(/<link\b[^>]*href="https:[^"]*"[^>]*>/g, '');
  if (coding) html = html.replace('</head>', '<link rel="stylesheet" href="/assets/codemirror/lib/codemirror.css"><script src="/assets/codemirror/lib/codemirror.js"></script><script src="/assets/codemirror/mode/javascript/javascript.js"></script><script src="/assets/codemirror/mode/python/python.js"></script><script src="/assets/codemirror/mode/clike/clike.js"></script><script src="/assets/codemirror/mode/go/go.js"></script></head>');
  html = html.replaceAll('href="/coding"', 'href="/desktop/coding"').replaceAll('href="/interview"', 'href="/desktop/interview"');
  return html.replace('</body>', '<script type="module" src="/assets/desktop-room.js"></script></body>');
}
