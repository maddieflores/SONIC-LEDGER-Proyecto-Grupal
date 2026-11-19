# Bienvenida y onboarding — Sonic Ledger

## Alcance

Solo presentación web y onboarding móvil. No se implementaron formularios, autenticación, backend, datos de negocio ni funciones musicales.

Web: `/`, `/registro` y `/iniciar-sesion`. Las dos rutas de acceso explican que la función todavía no está disponible; no solicitan credenciales.

Móvil: `/` consulta el estado local y redirige a `/onboarding` o `/welcome`. La introducción tiene tres páginas horizontales, indicadores, Siguiente, Atrás, Omitir y opciones de acceso al finalizar. `/welcome` permite volver a ver la introducción. `/registro` e `/iniciar-sesion` son destinos preparados, sin autenticación simulada.

## Persistencia

Clave: `sonic-ledger.onboarding.v1`, valor `completed`. SecureStore en Android/iOS y localStorage en Expo web. Se guarda al omitir o elegir una opción final. Si el guardado falla, se informa el error y se permite reintentar. Reiniciar la aplicación lleva a la bienvenida final; no a la introducción.

## Diseño y recursos

Fondos medianoche, luz violeta/magenta/cian, botones de degradado, componentes reales y recursos originales sin texto incrustado. Se agregó únicamente expo-linear-gradient, versión compatible con SDK 58. Las imágenes están empaquetadas localmente y no dependen de servicios externos al abrir la interfaz.

Recursos generados con la herramienta integrada ImageGen, convertidos a WebP para su distribución:

- `frontend/public/images/sonic-headphones.webp`
- `mobile/assets/sonic-headphones.webp`
- `mobile/assets/sonic-dj.webp`
- `mobile/assets/sonic-concert.webp`

### Prompts de generación

**Audífonos:** Use case: product-mockup. Create a high-end photorealistic 3D hero asset for Sonic Ledger music app, not a UI mockup. Square composition, a single pair of oversized premium black over-ear headphones floating diagonally, beautifully realistic cushioned ear cups, glossy midnight metal and electric violet, hot magenta rim lighting and thin cyan highlights. Centered subject fills 80% of image, tilted dynamic three-quarter view. Background near-black midnight navy #070713 with very subtle purple atmospheric haze, luminous magenta/cyan light trails curving behind, studio cinematic light, premium and elegant, not cluttered. Fade edges into solid near-black #070713 so this image integrates into a dark website hero. No text, no logos, no UI, no watermark. Save the generated asset for use in a real React and React Native project.

**DJ:** Square cinematic music product illustration for mobile onboarding. A premium futuristic DJ mixing console with two luminous violet turntables and magenta cyan waveform light suspended above, close-up three quarter angle. Dark midnight navy nearly black #070713 backdrop fading to solid dark at all edges. Sophisticated photorealistic 3D render, purple pink electric blue rim lighting, clean strong single composition filling central frame. No person, no robot face, no text, no logo, no UI or watermark.

**Concierto:** Square cinematic photograph style music concert asset for mobile onboarding. Silhouettes of a crowd at bottom, distant live stage with powerful fan-shaped magenta violet and electric blue light beams in atmospheric haze. Centered composition, premium sophisticated mood, midnight navy nearly black #070713 background fading to near-black around edges, no text no logos no UI no watermark. Realistic concert photography, clean composition, no identifiable faces.

## Verificaciones

- Web: compilación TypeScript/Vite y lint.
- Móvil: TypeScript, ESLint y exportación Android Hermes.
- Edge headless: landing a 1440×1000, 820×1180 y 390×844, sin desbordamiento horizontal; navegación y recarga directa de rutas.
- Expo web: Siguiente, Atrás, indicadores, gesto táctil horizontal, Omitir, destinos de registro/login y persistencia al reabrir la raíz.
- Vista compacta de 320×568; imágenes y texto revisados mediante capturas.
- Sin errores JavaScript observados en los recorridos del navegador.

Limitación: la prueba móvil se realizó con Expo web y emulación táctil en Edge. La exportación Android no equivale a una APK instalada. Pendiente verificar Safe Area, gesto y SecureStore en dispositivo Android/iOS real.

## Visualización

En esta sesión: web `http://localhost:5174` y vista de Expo `http://localhost:8083`. Se eligieron estos puertos porque 5173 y 8082 estaban ocupados.

Para reiniciar desde la raíz: `npm run dev:frontend` y `npm run dev:mobile`. Usar el puerto que indique cada servidor. Para inspeccionar siempre la introducción en Expo web, abrir `/onboarding`; al completar, la raíz muestra `/welcome`.
