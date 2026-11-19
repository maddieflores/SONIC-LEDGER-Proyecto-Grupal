import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const f=JSON.parse(await readFile('../tmp/cu08-fixture.json','utf8'));
const base='http://localhost:3000/api/auth/';
const login=await fetch(base+'login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.client.email,password:f.client.password})});
assert.equal(login.status,200);const token=(await login.json()).accessToken;
const headers={Authorization:'Bearer '+token};
async function get(path){const r=await fetch(base+'integrations/audius/'+path,{headers});assert.equal(r.status,200,await r.clone().text());return r.json();}
const trending=await get('trending?limit=5');const t=trending.data.find(t=>t.isPlayable);assert(t);
assert(t.id.startsWith('audius:'));assert((await get('search?query=house&limit=3')).tracks.length);
assert(Array.isArray((await get('search?query=brooke&type=artists&limit=3')).artists));
assert.equal((await get('artists/'+t.artist.id)).id,t.artist.id);
const stream=await fetch(base+'integrations/audius/tracks/'+t.id+'/audio',{headers:{...headers,Range:'bytes=0-65535'}});
assert([200,206].includes(stream.status),await stream.clone().text());const bytes=await stream.arrayBuffer();assert(bytes.byteLength>1000);
assert.equal((await fetch(base+'integrations/audius/trending')).status,401);
const local=await fetch(base+'catalog/'+f.song.id+'/audio',{headers:{...headers,Range:'bytes=0-43'}});assert.equal(local.status,206);
assert.equal((await fetch(base+'catalog/'+f.draftId+'/audio',{headers})).status,404);
await writeFile('../tmp/audius-live.json',JSON.stringify({track:t,client:f.client,local:f.song}),{mode:0o600});
console.log('AUDIUS LIVE OK: consulta, búsqueda de canciones/artistas, perfil, bytes reales de streaming; LOCAL Range y borradores protegidos. Sin escrituras en BD.');
