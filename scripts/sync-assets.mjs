import { copyFile, mkdir } from 'node:fs/promises';
// Self-host the official font/icon assets so pages need no third-party CSS CDN.
await mkdir('public/vendor', { recursive: true });
for (const [source, destination] of [
  ['@phosphor-icons/web/src/regular/Phosphor.woff2', 'Phosphor.woff2'],
  ['@phosphor-icons/web/src/regular/style.css', 'phosphor.css'],
  ['@phosphor-icons/web/LICENSE', 'phosphor-LICENSE.txt'],
  ['@fontsource-variable/geist/files/geist-latin-wght-normal.woff2', 'geist-latin.woff2'],
  ['@fontsource-variable/geist/LICENSE', 'geist-LICENSE.txt'],
]) await copyFile('node_modules/' + source, 'public/vendor/' + destination);
