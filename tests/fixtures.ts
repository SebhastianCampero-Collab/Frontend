import type {
  AuditDetails,
  AuditRun,
  Project,
  Health,
  HookLog,
  Delegation,
} from '../src/types/contracts';
export const project: Project = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Proyecto de prueba',
  repoPath: 'C:\\demo\\workspace',
  defaultBranch: 'main',
  runnerType: 'jest',
  createdAt: '2026-10-19T12:00:00.000Z',
};
export const auditId = '22222222-2222-4222-8222-222222222222';
export const health: Health = {
  status: 'ok',
  database: { connected: true, mode: 'local', tables: 5 },
  version: '0.1.0',
  uptimeSeconds: 120,
  runners: [{ runner: 'jest', available: true }],
};
export const log: HookLog = {
  id: 'log-1',
  auditId,
  hookId: 'protected-files',
  hookName: 'Protected files',
  event: 'pre:apply_patch',
  decision: 'block',
  reason: '.env está protegido',
  metadataJson: {},
  durationMs: 1,
  createdAt: '2026-10-19T12:00:00.000Z',
};
export const details: AuditDetails = {
  project,
  audit: {
    id: auditId,
    projectId: project.id,
    status: 'blocked',
    targetFile: 'src/bug.ts',
    branchName: null,
    baselineRunId: null,
    candidateRunId: null,
    commitSha: null,
    startedAt: '2026-10-19T12:00:00.000Z',
    finishedAt: '2026-10-19T12:00:01.000Z',
    summaryJson: {
      mode: 'diagnose',
      outcome: 'diagnosed',
      findings: [
        {
          path: 'src/bug.ts',
          source: 'typescript',
          code: '2322',
          severity: 'error',
          message: 'Type string is not assignable to number',
          range: null,
        },
      ],
    },
  },
  testRuns: [],
  hookLogs: [],
  delegations: [],
};
export const diagnosed: AuditRun = { ...details, mode: 'diagnose', status: 'blocked' };
export const config = {
  enabled: true,
  rules: { protected_files: true },
  protectedFiles: ['.env'],
  allowedBranches: ['fix/*'],
  maxPatchCharacters: 1000000,
  maxFiles: 200,
};
export const delegation: Delegation = {
  taskId: 'task-1',
  parentSessionId: auditId,
  subagentId: 'worker-1',
  role: 'diagnostic',
  status: 'completed',
  objective: 'Diagnosticar src/bug.ts',
  scopedContextJson: { path: 'src/bug.ts' },
  toolCallsJson: [{ tool: 'analyze_code', status: 'completed' }],
  outputJson: { rootCause: 'Error de tipos' },
  consumptionStatus: 'diagnosis_only',
  durationMs: 40,
  startedAt: '2026-10-19T12:00:00.000Z',
  finishedAt: '2026-10-19T12:00:01.000Z',
  phase: 'consumed',
  snapshots: [{ phase: 'delegated' }, { phase: 'returned' }, { phase: 'consumed' }],
};
export const tools = [
  'read_file_context',
  'analyze_code',
  'get_symbol_context',
  'git_status',
  'git_create_fix_branch',
  'git_begin_attempt',
  'git_apply_patch',
  'git_diff',
  'git_commit_fix',
  'git_rollback_attempt',
  'run_tests',
  'compare_test_runs',
  'git_rollback',
  'hooks_get_config',
  'hooks_get_logs',
  'subagents_get_delegations',
  'db_list_projects',
  'db_list_audits',
  'db_get_audit',
].map((name) => ({
  name,
  description: `Herramienta ${name}`,
  inputSchema: { type: 'object', properties: { projectId: { type: 'string' } } },
}));
export const reply = (data: unknown, status = 200, ok = true) =>
  new Response(JSON.stringify({ ok, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
