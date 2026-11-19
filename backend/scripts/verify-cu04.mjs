import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import ds from '../dist/data-source.js';
const root = 'http://localhost:3000/api/auth/';
async function call(
  path,
  body,
  token,
  method = body === undefined ? 'GET' : 'POST',
) {
  const response = await fetch(root + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json() };
}
async function upload(token, bytes, mime = 'image/png', kind = 'avatar') {
  const body = new FormData();
  body.append('file', new Blob([bytes], { type: mime }), 'untrusted-name.png');
  const r = await fetch(root + 'artist-profile/media/' + kind, {
    method: 'POST',
    headers: token ? { Authorization: 'Bearer ' + token } : {},
    body,
  });
  return { status: r.status, data: await r.json() };
}
try {
  await ds.initialize();
  const demoBefore = await ds.query(
    `SELECT a.* FROM artistas a JOIN usuarios u ON u.id=a.usuario_id WHERE u.email='demo.artista@example.com'`,
  );
  assert.equal(demoBefore.length, 1);
  const suffix = Date.now();
  const password = 'SonicCU04!' + suffix;
  const accounts = [];
  for (const [index, artist] of [true, true, false, true].entries()) {
    const email = `cu04.${suffix}.${index}@example.com`;
    const registered = await call('register', {
      email,
      password,
      username: 'Prueba CU04 ' + index,
      acceptedTerms: true,
    });
    assert.equal(registered.status, 201);
    if (artist)
      await ds.query(
        `INSERT INTO usuarios_roles(usuario_id,rol_id) SELECT $1,id FROM roles WHERE nombre='ARTISTA' ON CONFLICT DO NOTHING`,
        [registered.data.id],
      );
    const login = await call('login', { email, password });
    assert.equal(login.status, 200);
    accounts.push({
      email,
      password,
      id: registered.data.id,
      token: login.data.accessToken,
    });
  }
  const [a, b, client] = accounts;
  const catalog = await call('profile/genres', undefined, a.token);
  const ids = catalog.data.slice(0, 2).map((g) => g.id);
  const profile = {
    nombreArtistico: 'Prueba CU04 ' + suffix,
    biografia: 'Proyecto musical de prueba de integración CU04.',
    ciudad: 'La Paz',
    pais: 'Bolivia',
    genreIds: ids,
    identidad: ['Nocturno', 'Experimental'],
    redes: {
      instagram: 'https://instagram.com/sonicledger',
      website: 'https://example.com/',
    },
  };
  assert.equal(
    (await call('artist-profile', undefined, a.token)).data.profile,
    null,
  );
  assert.equal(
    (await call('artist-profile', profile, a.token, 'PATCH')).status,
    404,
  );
  const created = await call('artist-profile', profile, a.token);
  assert.equal(created.status, 201);
  assert.equal(created.data.statistics, null);
  assert.equal((await call('artist-profile', profile, a.token)).status, 409);
  const other = { ...profile, nombreArtistico: 'Segundo CU04 ' + suffix };
  assert.equal((await call('artist-profile', other, b.token)).status, 201);
  assert.equal(
    (
      await call(
        'artist-profile',
        {
          ...other,
          nombreArtistico: ' ' + profile.nombreArtistico.toUpperCase() + ' ',
        },
        b.token,
        'PATCH',
      )
    ).status,
    409,
  );
  for (const method of ['POST', 'PATCH']) {
    assert.equal(
      (await call('artist-profile', profile, undefined, method)).status,
      401,
    );
    assert.equal(
      (await call('artist-profile', profile, client.token, method)).status,
      403,
    );
  }
  assert.equal(
    (await call('artist-profile', undefined, client.token)).status,
    403,
  );
  for (const extra of [
    { usuarioId: b.id },
    { id: created.data.profile.id },
    { roles: ['ARTISTA'] },
    { avatarUrl: '/etc/passwd' },
    { genreIds: ['550e8400-e29b-41d4-a716-446655440000'] },
    { redes: { website: 'javascript:alert(1)' } },
    { redes: { instagram: 'https://evil.example' } },
    { identidad: ['inventada'] },
  ])
    assert.equal(
      (await call('artist-profile', { ...profile, ...extra }, a.token, 'PATCH'))
        .status,
      400,
    );
  assert.equal(
    (
      await call(
        'artist-profile/' + created.data.profile.id,
        other,
        b.token,
        'PATCH',
      )
    ).status,
    404,
  );
  const edited = { ...profile, ciudad: 'Cochabamba' };
  assert.equal(
    (await call('artist-profile', edited, a.token, 'PATCH')).status,
    200,
  );
  const relogin = await call('login', { email: a.email, password });
  const recovered = (
    await call('artist-profile', undefined, relogin.data.accessToken)
  ).data.profile;
  for (const key of Object.keys(edited))
    assert.deepEqual(recovered[key], edited[key]);
  assert.equal(
    (await call('artist-profile', undefined, b.token)).data.profile.ciudad,
    'La Paz',
  );
  const png = await readFile('../mobile/assets/icon.png');
  const image = await upload(a.token, png);
  assert.equal(image.status, 200, JSON.stringify(image));
  const media = await fetch('http://localhost:3000' + image.data.reference, {
    headers: { Authorization: 'Bearer ' + a.token },
  });
  assert.equal(media.status, 200);
  assert.equal(media.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await media.arrayBuffer()), png);
  assert.equal(
    (
      await fetch('http://localhost:3000' + image.data.reference, {
        headers: { Authorization: 'Bearer ' + b.token },
      })
    ).status,
    404,
  );
  assert.equal(
    (await fetch('http://localhost:3000' + image.data.reference)).status,
    401,
  );
  assert.equal((await upload(client.token, png)).status, 403);
  assert.equal(
    (await upload(a.token, Buffer.from('<svg/>'), 'image/png')).status,
    400,
  );
  assert.equal((await upload(a.token, png, 'image/jpeg')).status, 400);
  assert.equal((await upload(a.token, Buffer.alloc(2097153))).status, 413);
  assert.equal(
    (await upload(a.token, png, 'image/png', 'invalid')).status,
    400,
  );
  const demoAfter = await ds.query(
    `SELECT a.* FROM artistas a JOIN usuarios u ON u.id=a.usuario_id WHERE u.email='demo.artista@example.com'`,
  );
  assert.deepEqual(demoAfter, demoBefore);
  assert.equal(
    (
      await ds.query(`SELECT * FROM artistas_generos WHERE artista_id=$1`, [
        created.data.profile.id,
      ])
    ).length,
    ids.length,
  );
  await writeFile(
    '../tmp/cu04-fixture.json',
    JSON.stringify({
      artist: a,
      other: b,
      client,
      empty: accounts[3],
      profileName: profile.nombreArtistico,
    }),
    { mode: 0o600 },
  );
  console.log(
    'CU04 PostgreSQL OK: consulta/creación/edición, géneros, duplicados normalizados, roles, propiedad, re-login, validaciones, almacenamiento real PNG y rechazo 401/403/404/413. Perfil demo conservado sin restablecer cambios del usuario. Cuentas de prueba conservadas.',
  );
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  if (ds.isInitialized) await ds.destroy();
}
