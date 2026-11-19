import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const f = JSON.parse(await readFile('../tmp/cu08-fixture.json', 'utf8'));
assert(f.secondary?.id && f.secondary.titulo === 'CU08 · Prueba de cambio de pista');
assert(f.artist.email.startsWith('cu05.'));
const base = 'http://localhost:3000/api/auth/';
async function token(account) {
  const r = await fetch(base + 'login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.email, password: account.password }) });
  assert.equal(r.status, 200); return (await r.json()).accessToken;
}
const artist = await token(f.artist);
const result = await fetch(base + 'artist-songs/' + f.secondary.id + '/state', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + artist }, body: JSON.stringify({ estado: 'borrador' }) });
assert.equal(result.status, 200);
const client = await token(f.client);
for (const suffix of ['', '/audio']) {
  const r = await fetch(base + 'catalog/' + f.secondary.id + suffix, { headers: { Authorization: 'Bearer ' + client } });
  assert.equal(r.status, 404);
}
assert.equal((await fetch(base + 'artist-songs', { headers: { Authorization: 'Bearer ' + client } })).status, 403);
console.log('CU08 limpieza OK: publicación técnica devuelta a borrador, detalle y audio inaccesibles para cliente; administración artística denegada. Se conserva el registro, sin eliminar datos.');
