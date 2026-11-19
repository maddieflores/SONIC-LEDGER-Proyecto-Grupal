# Pantalla completa web y login móvil

Login, registro y recuperación web ocupan el ancho y alto de la pestaña. Se eliminó el marco exterior con márgenes y ancho máximo; el contenido conserva el ancho de lectura del onboarding. Las ilustraciones se adaptan al alto disponible para evitar scroll adicional en escritorio. El onboarding no se modificó.

El login de Expo ahora utiliza el retrato femenino con audífonos de la referencia: imagen superior de borde a borde, fundido oscuro, marca con barras de audio, título y subtítulo centrados, campos con iconos, mostrar/ocultar contraseña, Recordarme y recuperación en la misma fila, botón violeta/rosa y acceso a Crear cuenta. Se mantuvieron las sesiones y la recuperación local anteriores. No se añadieron proveedores sociales, conforme al alcance original.

Archivos modificados: `frontend/src/App.css`, `mobile/src/features/auth/AuthScreen.tsx`.

Recurso creado: `C:/Proyectos/Proyecto Final/mobile/assets/sonic-login-portrait.png`. Generado con image_gen integrada desde la última referencia adjunta; es una reconstrucción de la ilustración sin UI. No se usó la captura como fondo, ni se añadieron dependencias.

## Verificaciones

- Web: build TypeScript/Vite y lint aprobados.
- Móvil: TypeScript y lint aprobados.
- Web en 1920x980, 1536x768, 820x1180 y 360x800: login y registro ocupan todo el ancho y al menos el alto del viewport, sin desbordamiento horizontal. Sin scroll vertical adicional en los dos tamaños de escritorio.
- Expo Web en 390x844 y 320x568: capturas, correo/contraseña, visibilidad de contraseña, checkbox y navegación a registro y recuperación.
- Login y logout reales desde el nuevo formulario móvil contra PostgreSQL. Se conserva una cuenta de prueba `mobile-layout.<timestamp>@example.com`.
- Revisión visual de las capturas de registro web y login móvil. Pendiente comprobación física de teclado/Safe Area en Android/iOS; las pruebas anteriores se ejecutaron con Expo Web.

Script local: `node tmp/verify-auth-layout.cjs`, con web 5180, Expo Web 8086 y API 3004. Capturas en `tmp/fullscreen-*.png` y `tmp/mobile-login-portrait-*.png`. Para ejecutar normalmente se mantienen `npm run dev:frontend` y `npm run dev:mobile` desde la raíz, con los .env existentes.

## Prompt final del recurso visual

Use case: precise-object-edit. Asset type: portrait hero illustration for Sonic Ledger mobile login. Reconstruct ONLY the female portrait illustration in the TOP portion of the provided reference. Preserve the same young adult woman's face and head tilted slightly upward, closed eyes, long wavy dark hair, large over-ear futuristic headphones on both ears, electric blue facial lighting, magenta and violet rim light, subtle neon markings on cheek, dark purple atmospheric musical background. Match the character, angle, mood, and vivid premium digital painting as closely as possible. Composition: vertical 4:5 portrait, head and headphones large, face in upper center/right, full top of hair and both headphones visible with small breathing room, shoulders and hair below fading into solid #080511 in bottom quarter. Edge-to-edge composition designed to sit behind a logo at lower edge in a mobile screen. Output ONLY the illustration, NO UI, NO letters, NO logo, NO status bar, NO border, NO form, NO buttons, NO watermark. Do not reproduce the screen or social login buttons.
