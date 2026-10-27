import { readFile } from 'node:fs/promises';

// Use the web page markup and design system; only replace its cloud controller.
export async function desktopPage(coding = false) {
  let html = await readFile(`public/${coding ? 'coding' : 'index'}.html`, 'utf8');
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  html = html.replace(/<link\b[^>]*href="https:[^"]*"[^>]*>/g, '');
  html = html.replaceAll('href="/coding"', 'href="/desktop/coding"').replaceAll('href="/interview"', 'href="/desktop/interview"');
  return html.replace('</body>', '<script type="module" src="/assets/desktop-room.js"></script></body>');
}
