import { writeFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:3000/api';
const results = [];
async function get(path, token) {
  const start = performance.now();
  const response = await fetch(base + path, { headers: token ? { Authorization: 'Bearer ' + token } : {}, signal: AbortSignal.timeout(45000) });
  const data = await response.json();
  results.push({ path, status: response.status, elapsedMs: Math.round(performance.now() - start) });
  return data;
}
await get('/health');
await get('/conciertos');
await get('/sandbox-gateway/status');
const password = process.env.DEMO_CLIENTE_PASSWORD || process.env.DEMO_PASSWORD;
const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo.cliente@example.com', password, client: 'mobile' }) });
results.push({ path: '/auth/login', status: login.status });
if (login.ok) {
  const { accessToken } = await login.json();
  for (const path of ['/auth/me','/auth/catalog?page=1&pageSize=12','/auth/recommendations/music?limit=5','/auth/dj/status','/auth/library/playlists','/ticketing/mis-tickets','/auth/history/estadisticas']) await get(path, accessToken);
}
const verifierLogin = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo.verificador@example.com', password: process.env.DEMO_VERIFICADOR_PASSWORD || process.env.DEMO_PASSWORD, client: 'mobile' }) });
results.push({ path: 'verificador login', status: verifierLogin.status });
if (verifierLogin.ok) await get('/ticketing/verificador/conciertos', (await verifierLogin.json()).accessToken);
await writeFile('../docs/servicios-smoke-results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
// Never print credentials, JWTs, ticket QR contents or account data.
