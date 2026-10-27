export function guardrailExplanation(decision: 'allow' | 'block', reasons: readonly string[]): string {
  if (decision === 'allow') return 'Permitido por las reglas configuradas en el backend. No se modificó ningún archivo.';
  const protectedReason = reasons.find((reason) => /^Protected file:\s*.+/u.test(reason));
  if (protectedReason) return `Bloqueado porque ${protectedReason.replace(/^Protected file:\s*/u, '')} es un archivo protegido. No se modificó ningún archivo.`;
  if (reasons.some((reason) => /\.env.*(?:está protegido|archivo protegido)/iu.test(reason)))
    return 'Bloqueado porque .env es un archivo protegido. No se modificó ningún archivo.';
  if (reasons.some((reason) => /Secret pattern detected/iu.test(reason)))
    return 'Bloqueado porque el contenido coincide con un patrón de secreto. No se modificó ningún archivo.';
  return `El backend bloqueó la operación.${reasons.length ? ` Motivo registrado: ${reasons.join(' · ')}` : ''} No se modificó ningún archivo.`;
}
