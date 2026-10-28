import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const names = ['projects', 'review', 'results', 'security', 'subagents', 'mcp'];
const chosen = process.argv[2];
if (chosen && !names.includes(chosen)) throw new Error('Unknown remote.');
const define = { 'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'http://127.0.0.1:4107'), 'process.env.NODE_ENV': JSON.stringify('production') };
const output = path.join(root, 'dist-platform');
if (!chosen) {
  await build({ root, configFile: false, plugins: [react()], define, base: '/', build: { outDir: output, emptyOutDir: true, rollupOptions: { input: path.join(root, 'platform.html') } } });
  await rename(path.join(output, 'platform.html'), path.join(output, 'index.html'));
}
await mkdir(path.join(output, 'remotes'), { recursive: true });
let manifest = { version: 1, remotes: {} };
if (chosen) manifest = JSON.parse(await readFile(path.join(output, 'remotes/manifest.json'), 'utf8'));
for (const name of chosen ? [chosen] : names) {
  const destination = path.join(output, 'remotes', name);
  // Keep prior content-hashed entries: an already-open shell can still finish loading them.
  await build({ root, configFile: false, plugins: [react()], define, build: { outDir: destination, emptyOutDir: false, minify: true,
    lib: { entry: path.join(root, 'src/microfrontends', `${name}.tsx`), formats: ['es'], fileName: () => 'remote.js' } } });
  const code = await readFile(path.join(destination, 'remote.js'));
  const hash = createHash('sha256').update(code).digest('hex').slice(0, 16);
  const filename = `remote-${hash}.js`;
  await rename(path.join(destination, 'remote.js'), path.join(destination, filename));
  manifest.remotes[name] = `/remotes/${name}/${filename}`;
}
await writeFile(path.join(output, 'remotes/manifest.json.tmp'), JSON.stringify(manifest, null, 2));
await rename(path.join(output, 'remotes/manifest.json.tmp'), path.join(output, 'remotes/manifest.json'));
