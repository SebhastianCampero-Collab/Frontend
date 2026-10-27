export function explainError(text: string, status?: number): string {
  if (text.includes('Cannot initialize the workspace root'))
    return 'No pudimos abrir la carpeta de este proyecto. Si era una demo anterior, puede haber caducado. Puedes preparar una nueva';
  if (text.includes('Path or parent directory does not exist.')) return 'No encontramos el archivo o su carpeta. Actualiza el listado y selecciona un archivo disponible.';
  if (status === 401) return 'No tienes acceso a esta operación. Revisa el token en Opciones avanzadas y vuelve a intentarlo.';
  if (status === 429) return 'El servidor alcanzó su límite de operaciones. Espera antes de volver a intentarlo.';
  return text;
}
