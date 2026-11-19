import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import ds from '../dist/data-source.js';
const root='http://localhost:3000/api/auth/';
const f=JSON.parse(await readFile('../tmp/cu05-fixture.json','utf8'));
async function login(account){const r=await fetch(root+'login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})});assert.equal(r.status,200);return(await r.json()).accessToken;}
async function get(path,token){const r=await fetch(root+path,{headers:token?{Authorization:'Bearer '+token}:{}});return {status:r.status,data:await r.json()};}
try{await ds.initialize();const token=await login(f.client);const published=await ds.query(`SELECT c.id,c.titulo,c.genero_id,a.nombre_artistico,g.nombre AS genero FROM canciones c JOIN artistas a ON a.id=c.artista_id LEFT JOIN generos g ON g.id=c.genero_id WHERE c.estado='publicado' ORDER BY c."createdAt" DESC,c.id`);const drafts=await ds.query(`SELECT id FROM canciones WHERE estado='borrador' LIMIT 1`);assert(published.length,'Se necesita al menos una publicación real de CU05 para verificar el catálogo.');
 assert.equal((await get('catalog')).status,401);assert.equal((await get('artist-songs',token)).status,403);
 const all=await get('catalog?pageSize=50',token);assert.equal(all.status,200);assert.equal(all.data.total,published.length);assert.deepEqual(all.data.items.map(s=>s.id),published.slice(0,50).map(s=>s.id));assert.equal((await get('catalog?pageSize=1&page=1',token)).data.items.length,1);
 for(const value of [published[0].titulo,published[0].nombre_artistico,published[0].genero].filter(Boolean)){const r=await get('catalog?q='+encodeURIComponent(value),token);assert.equal(r.status,200);assert(r.data.items.some(s=>s.id===published[0].id));}
 const none=await get('catalog?q=cu07-no-match-'+Date.now(),token);assert.equal(none.data.total,0);
 if(published[0].genero_id){const r=await get('catalog?generoId='+published[0].genero_id,token);assert(r.data.items.every(s=>s.genero.id===published[0].genero_id));}
 const detail=await get('catalog/'+published[0].id,token);assert.equal(detail.status,200);assert.equal(detail.data.song.id,published[0].id);assert(!('audioUrl' in detail.data.song));assert(!('usuarioId' in detail.data.song.artista));assert(detail.data.moreByArtist.every(s=>s.artista.id===detail.data.song.artista.id&&s.id!==published[0].id));
 for(const item of all.data.items){const d=await get('catalog/'+item.id,token);assert.equal(d.status,200);if(item.coverUrl){const image=await fetch('http://localhost:3000'+item.coverUrl,{headers:{Authorization:'Bearer '+token}});assert.equal(image.status,200);assert(image.headers.get('content-type').startsWith('image/'));assert.equal((await fetch('http://localhost:3000'+item.coverUrl)).status,401);}}
 if(drafts.length){assert.equal((await get('catalog/'+drafts[0].id,token)).status,404);assert.equal((await get('catalog/'+drafts[0].id+'/cover',token)).status,404);}
 assert.equal((await get('catalog?estado=borrador',token)).status,400);assert.equal((await get('catalog?pageSize=51',token)).status,400);assert.equal((await get('catalog/not-an-id',token)).status,400);
 await writeFile('../tmp/cu07-fixture.json',JSON.stringify({client:f.client,published:all.data.items,draftId:drafts[0]?.id}),{mode:0o600});console.log('CU07 API OK: CLIENTE lee catálogo publicado real, busca por título/artista/género, filtra, pagina y consulta detalle/portadas; borradores y archivos privados permanecen ocultos. Sin cambios en PostgreSQL.');
}catch(e){console.error(e);process.exitCode=1;}finally{if(ds.isInitialized)await ds.destroy();}
