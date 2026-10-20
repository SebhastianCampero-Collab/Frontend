import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const execute = promisify(execFile);
const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index],
    value = process.argv[index + 1];
  if (!['--backend', '--resume', '--port'].includes(name) || !value || options.has(name))
    throw new Error(
      'Uso: node scripts/demo-backend.mjs --backend ../ProyectoCertiIA [--port 3001] [--resume test-results/demo.json]',
    );
  options.set(name, value);
}
const manifest = path.resolve('test-results/demo.json');
let state;
if (options.has('--resume'))
  state = JSON.parse(await readFile(path.resolve(options.get('--resume')), 'utf8'));
else {
  const backend = path.resolve(options.get('--backend') ?? '../ProyectoCertiIA');
  const require = createRequire(path.join(backend, 'package.json'));
  const root = await mkdtemp(path.join(tmpdir(), 'devguardian-ui-demo-'));
  const workspace = path.join(root, 'workspace');
  await mkdir(path.join(workspace, 'src'), { recursive: true });
  await mkdir(path.join(workspace, 'tests'));
  const before = 'export const add = (a: number, b: number): number => String(a - b);\n';
  const after = 'export const add = (a: number, b: number): number => a + b;\n';
  await writeFile(path.join(workspace, 'src/bug.ts'), before);
  await writeFile(
    path.join(workspace, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ['src/**/*.ts'] }),
  );
  const jestConfig = path.join(workspace, 'jest.config.cjs');
  await writeFile(
    jestConfig,
    "module.exports={testEnvironment:'node',testMatch:['**/bug.test.cjs'],transform:{},cache:false};\n",
  );
  await writeFile(
    path.join(workspace, 'tests/bug.test.cjs'),
    [
      "const fs=require('node:fs'),vm=require('node:vm');",
      `const ts=require(${JSON.stringify(require.resolve('typescript'))});`,
      "const compiled=ts.transpileModule(fs.readFileSync('src/bug.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;",
      'const loaded={exports:{}};vm.runInNewContext(compiled,{module:loaded,exports:loaded.exports});const add=loaded.exports.add;',
      "test('addition',()=>expect(add(2,1)).toBe(3));",
      "test('preserves existing behavior',()=>expect(Number(add(2,0))).toBe(2));",
    ].join('\n'),
  );
  const git = async (...args) =>
    execute('git', args, { cwd: workspace, timeout: 15000, windowsHide: true });
  await git('init', '-b', 'main');
  await git('config', 'user.name', 'DevGuardian Demo');
  await git('config', 'user.email', 'demo@devguardian.invalid');
  await git('config', 'core.autocrlf', 'false');
  await git('config', 'commit.gpgsign', 'false');
  await git('add', '.');
  await git('-c', 'core.hooksPath=.disabled-hooks', 'commit', '-m', 'Demo: failing baseline');
  const patch = `diff --git a/src/bug.ts b/src/bug.ts\n--- a/src/bug.ts\n+++ b/src/bug.ts\n@@ -1 +1 @@\n-${before}+${after}`;
  state = {
    backend,
    root,
    workspace,
    database: path.join(root, 'database.json'),
    jestConfig,
    fileHash: createHash('sha256').update(before).digest('hex'),
    patch,
    target: 'tests/bug.test.cjs',
  };
  await mkdir(path.dirname(manifest), { recursive: true });
  await writeFile(manifest, JSON.stringify(state, null, 2));
  await writeFile(path.join(root, 'repair.diff'), patch);
}
const { startHttpServer } = await import(
  pathToFileURL(path.join(state.backend, 'dist/server/index.js')).href
);
const { LocalFileDatabaseAdapter } = await import(
  pathToFileURL(path.join(state.backend, 'dist/db/index.js')).href
);
const port = Number(options.get('--port') ?? 3001);
const app = await startHttpServer({
  port,
  host: '127.0.0.1',
  workspaceRoots: [state.root],
  repository: await LocalFileDatabaseAdapter.create({ filePath: state.database }),
  allowedOrigin: 'http://127.0.0.1:5173,http://localhost:5173',
  logger: () => {},
  runners: [
    {
      runner: 'jest',
      executable: process.execPath,
      args: [
        path.join(state.backend, 'node_modules/jest/bin/jest.js'),
        '--config',
        state.jestConfig,
        '--runInBand',
      ],
      timeoutMs: 30000,
      maxOutputBytes: 100000,
    },
  ],
});
console.log(
  JSON.stringify(
    {
      url: app.url,
      manifest,
      workspace: state.workspace,
      fileHash: state.fileHash,
      patch: state.patch,
      target: state.target,
      resume: `node scripts/demo-backend.mjs --resume test-results/demo.json --port ${port}`,
    },
    null,
    2,
  ),
);
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await app.close();
  process.exitCode = 0;
};
process.once('SIGINT', () => void close());
process.once('SIGTERM', () => void close());
process.stdin.resume();
process.stdin.on('data', (data) => {
  if (data.toString().trim() === 'stop') {
    process.stdin.pause();
    void close();
  }
});
