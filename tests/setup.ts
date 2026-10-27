import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { api } from '../src/api/client';
// Controlled server-owned tree for existing UI tests. No guessed production paths.
beforeEach(() => {
  vi.spyOn(api, 'projectFiles').mockResolvedValue({ files: ['src/bug.ts', 'src/server/contracts.ts', 'src/calculator.ts', 'src/external.ts', 'src/other.ts', 'src/one.ts', 'src/two.ts', 'src/target-bug.ts', 'src/app.ts', 'README.md'].map((path) => ({ path, analyzable: path.endsWith('.ts') })), truncated: false });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});
