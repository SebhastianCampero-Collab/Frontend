import { z } from 'zod';

export const RunnerSchema = z.enum(['jest', 'pytest']);
export const ProjectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  repoPath: z.string(),
  defaultBranch: z.string(),
  runnerType: RunnerSchema,
  createdAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;
export const ProjectFilesSchema = z.object({ files: z.array(z.object({ path: z.string(), analyzable: z.boolean() })), truncated: z.boolean() });
export type ProjectFiles = z.infer<typeof ProjectFilesSchema>;
export const FileContextSchema = z.object({ path: z.string(), content: z.string(), startLine: z.number(), endLine: z.number(), fileHash: z.string(), truncated: z.boolean() });
export type Check = 'syntax' | 'semantic' | 'lint';
const ImportIssueSchema = z.object({ path: z.string(), code: z.string(), message: z.string() });
export const ImportValidationSchema = z.object({
  compatible: z.boolean(), scope: z.literal('static-analysis'), entryFile: z.string().nullable(),
  missing: z.array(ImportIssueSchema), warnings: z.array(ImportIssueSchema),
});
export const ImportReadySchema = z.object({ project: ProjectSchema, validation: ImportValidationSchema });
export type ImportReady = z.infer<typeof ImportReadySchema>;
export const ImportEventSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('progress'), data: z.object({ phase: z.string(), message: z.string() }) }),
  z.object({ event: z.literal('ready'), data: ImportReadySchema }),
  z.object({ event: z.literal('incompatible'), data: ImportValidationSchema }),
  z.object({ event: z.literal('failed'), data: z.object({ message: z.string() }) }),
]);
export type ImportEvent = z.infer<typeof ImportEventSchema>;
export const RegisterProjectSchema = ProjectSchema.omit({ id: true, createdAt: true });
export type RegisterProject = z.infer<typeof RegisterProjectSchema>;
export const HealthSchema = z.object({
  status: z.string(),
  database: z.object({
    connected: z.boolean(),
    mode: z.enum(['local', 'postgres']),
    tables: z.number(),
  }),
  version: z.string(),
  uptimeSeconds: z.number(),
  runners: z.array(z.object({ runner: z.string(), available: z.boolean() })),
  capabilities: z.object({ isolatedTests: z.boolean(), requiresIsolation: z.boolean().optional() }).optional(),
});
export type Health = z.infer<typeof HealthSchema>;
export const DiagnosticSchema = z.object({
  path: z.string(),
  source: z.string(),
  code: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
  message: z.string(),
  range: z
    .object({
      start: z.object({ line: z.number(), column: z.number() }),
      end: z.object({ line: z.number(), column: z.number() }),
    })
    .nullable(),
});
export type Diagnostic = z.infer<typeof DiagnosticSchema>;
export const TestRunSchema = z.object({
  runId: z.uuid(),
  runner: RunnerSchema,
  status: z.enum(['passed', 'failed', 'timeout', 'error', 'cancelled']),
  complete: z.boolean(),
  truncated: z.boolean(),
  durationMs: z.number(),
  summary: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    skipped: z.number(),
    todo: z.number(),
  }),
  cases: z.array(
    z.object({
      id: z.string(),
      path: z.string(),
      name: z.string(),
      status: z.enum(['passed', 'failed', 'skipped', 'todo']),
      failureMessage: z.string().nullable(),
    }),
  ),
  workspaceStateHash: z.string(),
  configurationHash: z.string(),
});
export type TestRun = z.infer<typeof TestRunSchema>;
export const HookLogSchema = z.object({
  id: z.string(),
  auditId: z.string(),
  hookId: z.string(),
  hookName: z.string(),
  event: z.string(),
  decision: z.enum(['allow', 'block', 'warn']),
  reason: z.string(),
  metadataJson: z.record(z.string(), z.unknown()),
  durationMs: z.number(),
  createdAt: z.string(),
});
export type HookLog = z.infer<typeof HookLogSchema>;
export const HookConfigSchema = z.object({
  enabled: z.boolean(),
  rules: z.record(z.string(), z.boolean()),
  protectedFiles: z.array(z.string()),
  allowedBranches: z.array(z.string()),
  maxPatchCharacters: z.number(),
  maxFiles: z.number(),
});
export const DelegationSchema = z.object({
  taskId: z.string(),
  parentSessionId: z.string(),
  subagentId: z.string().nullable(),
  role: z.enum(['diagnostic', 'verification', 'patch-safety']),
  status: z.string(),
  objective: z.string(),
  scopedContextJson: z.unknown(),
  toolCallsJson: z.array(z.unknown()),
  outputJson: z.unknown(),
  consumptionStatus: z.string().nullable(),
  durationMs: z.number(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  phase: z.enum(['delegated', 'returned', 'consumed']),
  snapshots: z.array(z.unknown()),
});
export type Delegation = z.infer<typeof DelegationSchema>;
export const AuditSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  status: z.enum(['pending', 'running', 'committed', 'rolled_back', 'blocked', 'failed']),
  targetFile: z.string(),
  branchName: z.string().nullable(),
  baselineRunId: z.string().nullable(),
  candidateRunId: z.string().nullable(),
  commitSha: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  summaryJson: z.record(z.string(), z.unknown()),
});
export const AuditDetailsSchema = z.object({
  project: ProjectSchema,
  audit: AuditSchema,
  testRuns: z.array(TestRunSchema),
  hookLogs: z.array(HookLogSchema),
  delegations: z.array(DelegationSchema),
});
export type AuditDetails = z.infer<typeof AuditDetailsSchema>;
export const AuditRunSchema = AuditDetailsSchema.extend({
  mode: z.enum(['diagnose', 'repair']),
  status: z.string(),
  diagnostic: z.unknown().optional(),
  result: z.unknown().optional(),
});
export type AuditRun = z.infer<typeof AuditRunSchema>;
export const RelativePathSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith('/') &&
      !value.includes('\\') &&
      !value.split('/').some((part) => part === '..' || part === '.' || !part) &&
      !/^[a-z]:/i.test(value),
    'Usa una ruta relativa dentro del proyecto.',
  );
export const RepairSchema = z
  .object({
    parentSessionId: z.uuid().optional(),
    path: RelativePathSchema,
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(128),
    message: z.string().trim().min(1).max(4096),
    unifiedDiff: z.string().min(1).max(1_000_000),
    expectedFileHashes: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
    runner: RunnerSchema,
    targets: z.array(RelativePathSchema).min(1).max(200),
  })
  .strict()
  .refine(
    (value) =>
      Object.keys(value.expectedFileHashes).length === 1 && value.path in value.expectedFileHashes,
    'El hash debe corresponder exactamente al archivo objetivo.',
  );
export type Repair = z.infer<typeof RepairSchema>;
export const DemoSetupSchema = z.object({ project: ProjectSchema, repair: RepairSchema });
export type DemoSetup = z.infer<typeof DemoSetupSchema>;
export type AuditRequest =
  | { projectId: string; mode: 'diagnose'; path: string; checks?: Check[] }
  | { projectId: string; mode: 'repair'; repair: Repair };
export const HookEvaluationSchema = AuditDetailsSchema.extend({
  auditId: z.string(),
  decision: z.enum(['allow', 'block']),
});
export const McpToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()),
});
export type McpTool = z.infer<typeof McpToolSchema>;
export interface ListFilter {
  projectId?: string;
  auditId?: string;
  limit?: number;
  offset?: number;
}
export function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function findings(details: AuditDetails): Diagnostic[] {
  const parsed = z.array(DiagnosticSchema).safeParse(details.audit.summaryJson['findings']);
  return parsed.success ? parsed.data : [];
}
export function auditLabel(details: AuditDetails): string {
  const summary = details.audit.summaryJson;
  if (summary['mode'] === 'diagnose' && summary['outcome'] === 'diagnosed') return 'diagnosed';
  if (summary['mode'] === 'hook_evaluation')
    return summary['decision'] === 'allow' ? 'allowed' : 'blocked';
  if (summary['mode'] === 'mcp_tool' && summary['outcome'] === 'completed') return 'tool_completed';
  return details.audit.status;
}
