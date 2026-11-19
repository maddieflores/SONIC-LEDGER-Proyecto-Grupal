# Ajuste de Crear cuenta y recuperación de contraseña

## Resultado

Crear cuenta web muestra la persona con audífonos, halo rosa y ecualizador a la izquierda, y el formulario real a la derecha. Se sustituyó el gráfico de ondas por una ilustración individual reconstruida desde la referencia. El onboarding no se cambió. La vista móvil del formulario web también conserva la ilustración.

Iniciar sesión incorpora “¿Olvidaste tu contraseña?” en web y Expo. Las rutas nuevas son `/recuperar-contrasena` y `/restablecer-contrasena` en ambas plataformas.

## Correo local, según preferencia del usuario

No se envía correo real. Cada mensaje de prueba se guarda como JSON en `backend/.local/mail/` e incluye `to`, `subject`, `text` y `resetUrl`. Esa carpeta está ignorada por Git y no se expone mediante HTTP. Para probar:

1. Registrar una cuenta o usar una existente.
2. Pulsar “¿Olvidaste tu contraseña?” e introducir el correo.
3. Abrir el JSON más reciente dirigido a esa cuenta en `backend/.local/mail/`.
4. Abrir `resetUrl` en el navegador, introducir y confirmar la nueva contraseña.
5. Iniciar sesión con la nueva contraseña. La anterior deja de funcionar.

El enlace vence en 15 minutos y solo se puede consumir una vez. Solicitar otro enlace reemplaza al anterior. Se almacena únicamente el hash SHA-256 del token en PostgreSQL; los tokens se generan con 32 bytes criptográficamente aleatorios. El cambio de contraseña se realiza con una actualización atómica y también incrementa la versión de autenticación: los JWT emitidos previamente dejan de ser aceptados.

Las respuestas de solicitud son iguales para correos registrados y no registrados. Hay un mínimo de 500 ms por solicitud, límite de 3 solicitudes por correo y 20 por IP en una ventana de 15 minutos. Los límites son locales al proceso; un despliegue con varias instancias necesitará un almacén compartido. El modo de correo local está deshabilitado en producción. El transporte de correo real se configurará en una tarea posterior si se solicita.

Variables (documentadas en `backend/.env.example`):

```dotenv
PASSWORD_RESET_MAIL_MODE=local
PASSWORD_RESET_URL=http://localhost:5173/restablecer-contrasena
```

La URL es fija, administrada por configuración; no se construye desde el encabezado Host. El token se incluye en el fragmento del enlace web para evitar que aparezca en los registros HTTP o encabezados Referer. La pantalla retira el fragmento al abrirse y mantiene el token solo en memoria. Si se recarga antes de guardar, debe volver a abrirse el enlace completo. No se muestran ni registran tokens en respuestas o consola. El correo local sí contiene el enlace, por tratarse del buzón privado de desarrollo.

En un teléfono físico, configurar PASSWORD_RESET_URL con una dirección web accesible desde el teléfono, y EXPO_PUBLIC_API_URL con la IP LAN de la PC. El enlace del correo abre el formulario web; la app también tiene una ruta nativa de restablecimiento que acepta el parámetro token mediante Expo Router.

## API y base de datos

- `POST /api/auth/forgot-password`: `{ email }`, respuesta genérica 202.
- `POST /api/auth/reset-password`: `{ token, password }`, respuesta 200 tras cambiar la contraseña; 400 para enlaces inválidos, vencidos o usados.
- Validación de correo, token hexadecimal, contraseña de 8–72 caracteres con máximo efectivo de 72 bytes por bcrypt; límite 429 para exceso de intentos.
- Migración `PasswordRecovery1794481000000` aplicada en PostgreSQL local. Añade authVersion, passwordResetHash, passwordResetExpiresAt e índice único parcial. No se borraron usuarios ni se activó synchronize.

En otros entornos ejecutar desde la raíz:

```powershell
npm --prefix backend run migration:run
```

Después iniciar backend, frontend y Expo con los comandos existentes (`npm run dev:backend`, `npm run dev:frontend`, `npm run dev:mobile`). Los servidores iniciados previamente deben reiniciarse para cargar el backend actualizado.

## Verificaciones

- Backend: build, lint y 9 pruebas aprobadas en 3 archivos.
- Web: build TypeScript/Vite y lint aprobados.
- Expo: TypeScript y lint aprobados.
- Prueba real con PostgreSQL y Edge: enlace desde login, solicitud de correo local, respuesta genérica para correo inexistente, token guardado como hash, expiración, reemplazo de enlaces, confirmación de contraseñas, cambio de contraseña, rechazo de contraseña anterior, rechazo de JWT anterior, reutilización rechazada, consumo concurrente único y límite 429.
- Nueve capturas de registro, login y recuperación en 1440x900, 820x1180 y 360x800; sin desbordamiento horizontal.
- Expo Web a 360x740: navegación a recuperación, solicitud y confirmación genérica correctas. Pendiente prueba nativa física de teclado/Safe Area/deep links en Android/iOS.
- Se conservaron cuentas `recovery.<timestamp>@example.com` y sus correos locales de prueba; no se borraron datos.
- Script local: `node --env-file=backend/.env tmp/verify-recovery.cjs`, con API 3004, web 5180 y Expo Web 8086 en ejecución. Usa el runtime Playwright local indicado en el archivo.

Durante esta verificación se iniciaron instancias separadas sin modificar `.env`: API en 3004, web en 5180 y Expo Web en 8086. El backend de prueba utiliza PASSWORD_RESET_URL=http://localhost:5180/restablecer-contrasena y CORS_ORIGINS=http://localhost:5180,http://localhost:8086.

## Archivos principales

Creados: `backend/src/auth/recovery-mail.service.ts`, `password-recovery.service.ts`, `password-recovery.controller.ts`, `password-recovery.spec.ts`; `backend/src/migrations/1794481000000-PasswordRecovery.ts`; `frontend/src/Recovery.tsx`; `frontend/public/images/sonic-listener.png`; `mobile/src/features/auth/RecoveryScreen.tsx`; `mobile/src/app/recuperar-contrasena.tsx`; `mobile/src/app/restablecer-contrasena.tsx`.

Modificados: `backend/src/auth/{auth.module,auth.dto,auth.service,usuario.entity}.ts`, `backend/src/data-source.ts`, `backend/.env.example`, `.gitignore`, `frontend/src/{Auth.tsx,App.tsx,App.css}`, `mobile/src/features/auth/AuthScreen.tsx`.

## Recurso visual

Herramienta utilizada: image_gen integrada, modo de edición desde la referencia adjunta. No se usó CLI ni API key. Recurso final guardado en `C:/Proyectos/Proyecto Final/frontend/public/images/sonic-listener.png`.

Prompt final:

> Use case: precise-object-edit. Asset for Sonic Ledger registration website. Extract and faithfully reconstruct ONLY the illustration on the LEFT side of the reference: same young man in side profile facing right and slightly upward, eyes closed, curly dark hair, large black futuristic neon headphones, black hoodie, electric blue lighting on face and magenta rim lighting, bright magenta circular halo behind the head, subtle violet equalizer bars at bottom. Preserve the character, pose, illustration rendering style and composition as closely as possible to the reference. Output a high-resolution PORTRAIT illustration, no interface, no form, no text, no logo, no border. Full head and upper torso in frame, halo fully visible with breathing room, dark midnight #080511 background that fades seamlessly to solid #080511 at edges. This is an individual image asset to embed next to a real HTML form, not a screenshot or UI mockup. Do not include any elements from the right side of the reference.

La ilustración es una reconstrucción de la referencia; los formularios, navegación y textos siguen siendo componentes reales accesibles.
