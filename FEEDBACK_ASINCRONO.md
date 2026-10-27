# Feedback de operaciones asíncronas y recuperación

## Recargas

`useResource` conserva una única lectura en curso por recurso, cancela lecturas obsoletas al cambiar de ámbito y descarta respuestas de un proyecto anterior. Una recarga repetida se une a la lectura pendiente en lugar de abortarla y crear otra.

`RefreshButton` presenta Actualizando..., Actualizado a las [hora], No hay registros nuevos o el error concreto. La hora corresponde al fin de una consulta manual exitosa en el navegador. El resultado se compara con la última respuesta conocida del mismo ámbito mediante su contenido JSON, incluyendo cambios en el estado de registros existentes. No se usa únicamente la longitud del array.

Las consultas periódicas continúan actualizando los datos sin sobrescribir el feedback de la última recarga manual. Los filtros/proyectos nuevos comienzan con un ámbito y una comparación independientes. Los fallos conservan los datos previos como última información conocida y permiten reintentar la lectura.

Se utiliza en Recargar trazas, Recargar logs y Recargar BD. El listado de archivos también muestra Actualizando... mientras carga. Los controles correspondientes quedan deshabilitados durante su solicitud.

## Errores comprensibles

`src/utils/errors.ts` centraliza la traducción. ApiError conserva status, code y el mensaje original en technicalMessage, y expone un mensaje legible. ErrorNotice, las acciones y las razones de resultados también usan la misma traducción.

Cannot initialize the workspace root se presenta exactamente como:

> No pudimos abrir la carpeta de este proyecto. Si era una demo anterior, puede haber caducado. Puedes preparar una nueva

Se incluyen indicaciones para archivos inexistentes, falta de autenticación y capacidad del servidor. Los mensajes desconocidos se conservan para no ocultar su causa.

## Progreso de reparación real

No se añadió una barra de progreso ni una secuencia temporizada de etapas. El cliente envía un parentSessionId UUID para la reparación, usando el contrato existente del backend; ese identificador es también el de su auditoría persistida.

Mientras la petición POST está activa, se consulta GET /api/audits/{id} cada dos segundos cuando la pestaña es visible. La respuesta se acepta solo si la auditoría y el proyecto coinciden con el intento actual. La interfaz muestra el último evento relevante confirmado en los hookLogs: análisis, comprobación del parche, preparación de pruebas, registro de una ejecución o controles/registro del commit. La hora procede de createdAt del evento del backend.

Un evento pre no demuestra que el paso haya terminado. Sin registros se muestra Esperando el primer registro del backend; no se supone que el análisis o las pruebas hayan comenzado. El polling puede saltarse etapas breves: se informa el último evento persistido disponible, sin fabricar estados intermedios.

Si falla el transporte, no se reenvía automáticamente la reparación. Continúa la consulta de la misma auditoría y se mantiene bloqueado el formulario hasta confirmar un estado terminal o recibir un rechazo HTTP definitivo. Consultar estado del intento es una lectura, no un segundo POST.

Solo el UUID pendiente se conserva en sessionStorage, separado por proyecto y URL de backend; nunca se guardan parches, tokens ni credenciales para esta recuperación. Al volver a montar el workspace se reanuda la consulta, no la ejecución. Una respuesta antigua no elimina el marcador de un intento más reciente.

Si no hay almacenamiento de sesión disponible, el bloqueo sigue funcionando mientras el formulario esté montado. La coordinación entre navegadores, pestañas independientes o procesos requiere controles del servidor; este mecanismo no sustituye su serialización ni los contratos de Git.

Si el servidor desaparece o deja una auditoría permanentemente en running tras un fallo, el cliente no inventa una finalización ni autoriza un nuevo intento: hace falta revisar el estado del backend. No se implementó un scheduler ni reconciliación de trabajos tras reiniciar el servidor.

Una carpeta inaccesible en el preflight de runAudit ahora devuelve HTTP 409 con FILE_SYSTEM_ERROR antes de crear una auditoría o aplicar parches. Esto permite liberar el formulario y preparar otro proyecto sin confundir ese rechazo definitivo con un corte de red después de comenzar una reparación. Se verifica en `tests/server/preflight.test.mjs` del backend.

## Bloqueo de controles

Los formularios de auditoría, lectura y registro usan fieldsets deshabilitados durante sus operaciones. Se conservan los locks síncronos de useAction y se añade un lock para la reparación y su seguimiento. Durante una auditoría el layout bloquea la selección de proyecto, la navegación habitual y la recarga que desmontaría el workspace. El acceso para corregir la autenticación permanece disponible si se necesita recuperar la conexión.

Los filtros, paginación y botones de recarga evitan solicitudes simultáneas del mismo recurso. Los controles de seguridad del backend permanecen activos; habilitar o deshabilitar una vista no altera permisos.

Pruebas: `tests/async-feedback.test.tsx` cubre respuestas nuevas/iguales, fallos/reintentos, coalescencia, excepción síncrona, traducción de errores, eventos reales, ausencia de progreso inventado y recuperación sin reenviar reparaciones.
