import type { HookLog, HookConfigSchema } from '../types/contracts';
import type { z } from 'zod';
export function securityPolicies(config: z.infer<typeof HookConfigSchema>) {
  const rule = (id: string) => config.enabled && config.rules[id] !== false;
  const protection = rule('protected-files-and-secrets');
  return [
    { id: 'files', name: 'Bloqueo de archivos protegidos', enabled: protection && config.protectedFiles.length > 0, detail: config.protectedFiles.length ? config.protectedFiles.join(', ') : 'No se configuraron patrones de archivos protegidos.' },
    { id: 'secrets', name: 'Detección de secretos en parches', enabled: protection, detail: 'Comprueba patrones de secretos antes de aplicar cambios.' },
    { id: 'branches', name: 'Restricción de ramas para commits', enabled: protection && config.allowedBranches.length > 0, detail: config.allowedBranches.length ? config.allowedBranches.join(', ') : 'No se configuraron restricciones de rama.' },
    { id: 'limits', name: 'Límites del parche', enabled: protection, detail: `Hasta ${config.maxFiles} archivos y ${config.maxPatchCharacters.toLocaleString()} caracteres.` },
    { id: 'verification', name: 'Evidencia de pruebas antes del commit', enabled: rule('verified-evidence-commit'), detail: 'Exige evidencia válida de verificación para confirmar una corrección.' },
    { id: 'audit', name: 'Registro de decisiones de seguridad', enabled: rule('database-audit-trail'), detail: 'Conserva las decisiones de los hooks para su auditoría.' },
  ];
}
export function interceptedFile(log: HookLog): string | null {
  const fields = log.metadataJson['files'];
  if (Array.isArray(fields)) {
    const paths = fields.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 4096);
    if (paths.length) return paths.join(', ');
  }
  const protectedPath = /^Protected file:\s*(.+)$/u.exec(log.reason)?.[1];
  if (protectedPath) return protectedPath;
  if (/^\.env (?:está protegido|es un archivo protegido)/iu.test(log.reason)) return '.env';
  return null;
}
