import assert from 'node:assert/strict';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import ds from '../dist/data-source.js';
const root = 'http://localhost:3000/api/auth/';
async function call(
  path,
  body,
  token,
  method = body === undefined ? 'GET' : 'POST',
) {
  const r = await fetch(root + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: r.status, data: await r.json() };
}
async function upload(id, kind, token, buffer, mime, name) {
  const body = new FormData();
  body.append('file', new Blob([buffer], { type: mime }), name);
  const r = await fetch(root + 'artist-songs/' + id + '/' + kind, {
    method: 'POST',
    headers: token ? { Authorization: 'Bearer ' + token } : {},
    body,
  });
  return { status: r.status, data: await r.json() };
}
function wav() {
  const count = 16000 * 3,
    b = Buffer.alloc(44 + count * 2);
  b.write('RIFF');
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++)
    b.writeInt16LE(
      Math.round(Math.sin((i * 220 * 2 * Math.PI) / 16000) * 6000),
      44 + i * 2,
    );
  return b;
}
function cover() {
  function crc(b) {
    let c = 0xffffffff;
    for (const v of b) {
      c ^= v;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(t, d) {
    const b = Buffer.alloc(d.length + 12);
    b.writeUInt32BE(d.length);
    b.write(t, 4);
    d.copy(b, 8);
    b.writeUInt32BE(crc(b.subarray(4, b.length - 4)), b.length - 4);
    return b;
  }
  const size = 1200,
    h = Buffer.alloc(13);
  h.writeUInt32BE(size);
  h.writeUInt32BE(size, 4);
  h[8] = 8;
  h[9] = 2;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = y * (size * 3 + 1) + 1 + x * 3;
      raw[n] = Math.round(50 + (180 * y) / size);
      raw[n + 1] = 10 + Math.round((40 * x) / size);
      raw[n + 2] = 180;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', h),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
try {
  await ds.initialize();
  const demoBefore = await ds.query(
    `SELECT a.* FROM artistas a JOIN usuarios u ON u.id=a.usuario_id WHERE u.email='demo.artista@example.com'`,
  );
  const suffix = Date.now(),
    password = 'SonicCU05!' + suffix,
    accounts = [];
  for (const [index, isArtist] of [true, true, false, true].entries()) {
    const email = `cu05.${suffix}.${index}@example.com`;
    const r = await call('register', {
      email,
      password,
      username: 'Prueba CU05 ' + index,
      acceptedTerms: true,
    });
    assert.equal(r.status, 201);
    if (isArtist)
      await ds.query(
        `INSERT INTO usuarios_roles(usuario_id,rol_id) SELECT $1,id FROM roles WHERE nombre='ARTISTA' ON CONFLICT DO NOTHING`,
        [r.data.id],
      );
    const login = await call('login', { email, password });
    assert.equal(login.status, 200);
    accounts.push({
      email,
      password,
      token: login.data.accessToken,
      id: r.data.id,
    });
    if (isArtist && index < 2) {
      const artist = await call(
        'artist-profile',
        {
          nombreArtistico: 'Laboratorio Neón ' + suffix + ' ' + index,
          biografia: 'Cuenta de integración CU05',
          ciudad: 'La Paz',
          pais: 'Bolivia',
          genreIds: [],
          identidad: [],
          redes: {},
        },
        login.data.accessToken,
      );
      assert.equal(artist.status, 201);
      accounts[index].artistId = artist.data.profile.id;
    }
  }
  const [a, b, client, noProfile] = accounts;
  assert.equal(
    (await call('artist-songs/dashboard', undefined, noProfile.token)).status,
    409,
  );
  const options = await call('artist-songs/options', undefined, a.token);
  assert.equal(options.status, 200);
  assert(options.data.genres.length);
  const genre = options.data.genres[0].id;
  const ownRelease = (
    await ds.query(
      `INSERT INTO lanzamientos(artista_id,titulo,tipo) VALUES ($1,$2,'SINGLE') RETURNING id`,
      [a.artistId, 'Sesión de prueba CU05'],
    )
  )[0].id;
  const foreignRelease = (
    await ds.query(
      `INSERT INTO lanzamientos(artista_id,titulo,tipo) VALUES ($1,$2,'SINGLE') RETURNING id`,
      [b.artistId, 'Sesión ajena CU05'],
    )
  )[0].id;
  const dto = {
    titulo: 'Luz de laboratorio',
    descripcion: 'Audio de integración real. CU05.',
    generoId: genre,
    lanzamientoId: ownRelease,
  };
  assert.equal((await call('artist-songs', dto)).status, 401);
  assert.equal((await call('artist-songs', dto, client.token)).status, 403);
  assert.equal(
    (await call('artist-songs/dashboard', undefined, client.token)).status,
    403,
  );
  assert.equal(
    (
      await call(
        'artist-songs',
        { ...dto, lanzamientoId: foreignRelease },
        a.token,
      )
    ).status,
    400,
  );
  for (const extra of [
    { artistaId: b.artistId },
    { estado: 'publicado' },
    { duracionSegundos: 180 },
    { archivoAudioUrl: '/etc/passwd' },
    { titulo: ' ' },
    { generoId: '550e8400-e29b-41d4-a716-446655440000' },
  ])
    assert.equal(
      (await call('artist-songs', { ...dto, ...extra }, a.token)).status,
      400,
    );
  const created = await call('artist-songs', dto, a.token);
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal(created.data.estado, 'borrador');
  assert.equal(
    (
      await call(
        'artist-songs/' + id + '/state',
        { estado: 'publicado' },
        a.token,
        'PATCH',
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await upload(
        id,
        'audio',
        a.token,
        Buffer.from('fake'),
        'audio/wav',
        'fake.wav',
      )
    ).status,
    400,
  );
  assert.equal(
    (await upload(id, 'audio', a.token, wav(), 'audio/mpeg', 'song.mp3'))
      .status,
    400,
  );
  const audio = await upload(
    id,
    'audio',
    a.token,
    wav(),
    'audio/wav',
    'real.wav',
  );
  assert.equal(audio.status, 200, JSON.stringify(audio));
  assert.equal(audio.data.duracionSegundos, 3);
  assert.equal(
    (
      await upload(
        id,
        'cover',
        a.token,
        await readFile('../mobile/assets/icon.png'),
        'image/png',
        'small.png',
      )
    ).status,
    400,
  );
  const image = cover();
  const coverResult = await upload(
    id,
    'cover',
    a.token,
    image,
    'image/png',
    'real-cover.png',
  );
  assert.equal(coverResult.status, 200, JSON.stringify(coverResult));
  const audioUrl = audio.data.audioUrl,
    coverUrl = coverResult.data.coverUrl;
  for (const url of [audioUrl, coverUrl]) {
    assert.equal((await fetch('http://localhost:3000' + url)).status, 401);
    assert.equal(
      (
        await fetch('http://localhost:3000' + url, {
          headers: { Authorization: 'Bearer ' + b.token },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch('http://localhost:3000' + url, {
          headers: { Authorization: 'Bearer ' + client.token },
        })
      ).status,
      403,
    );
  }
  const stored = await fetch('http://localhost:3000' + audioUrl, {
    headers: { Authorization: 'Bearer ' + a.token },
  });
  assert.equal(stored.status, 200);
  assert.deepEqual(Buffer.from(await stored.arrayBuffer()), wav());
  assert.equal(
    (await call('artist-songs/' + id, undefined, b.token)).status,
    404,
  );
  assert.equal(
    (
      await call(
        'artist-songs/' + id,
        { ...dto, titulo: 'Ataque' },
        b.token,
        'PATCH',
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        'artist-songs/' + id + '/state',
        { estado: 'publicado' },
        b.token,
        'PATCH',
      )
    ).status,
    404,
  );
  assert.equal(
    (await upload(id, 'audio', b.token, wav(), 'audio/wav', 'own.wav')).status,
    404,
  );
  assert.equal(
    (
      await call(
        'artist-songs/' + id + '/state',
        { estado: 'publicado' },
        a.token,
        'PATCH',
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        'artist-songs/' + id,
        { ...dto, generoId: null },
        a.token,
        'PATCH',
      )
    ).status,
    400,
  );
  const update = {
    ...dto,
    titulo: 'Luces de Neón',
    descripcion: 'Título y descripción persistidos en PostgreSQL.',
  };
  assert.equal(
    (await call('artist-songs/' + id, update, a.token, 'PATCH')).status,
    200,
  );
  const login = await call('login', { email: a.email, password: a.password });
  const persisted = await call(
    'artist-songs/' + id,
    undefined,
    login.data.accessToken,
  );
  assert.equal(persisted.data.titulo, update.titulo);
  assert.equal(persisted.data.estado, 'publicado');
  assert.equal(
    (await call('artist-songs?estado=publicado', undefined, a.token)).data
      .items[0].id,
    id,
  );
  assert.equal(
    (
      await call(
        'artist-songs/' + id + '/state',
        { estado: 'borrador' },
        a.token,
        'PATCH',
      )
    ).status,
    200,
  );
  assert.equal(
    (await call('artist-songs/' + id, undefined, a.token)).data.estado,
    'borrador',
  );
  assert.equal(
    (
      await call(
        'artist-songs/' + id + '/state',
        { estado: 'publicado' },
        a.token,
        'PATCH',
      )
    ).status,
    200,
  );
  const moreIds = [];
  for (let index = 0; index < 12; index++) {
    const r = await call(
      'artist-songs',
      {
        ...dto,
        titulo:
          ['Sin Final', 'Vértigo', 'Cielos de Neón', 'Otro Planeta'][
            index % 4
          ] +
          ' ' +
          index,
        lanzamientoId: null,
      },
      a.token,
    );
    assert.equal(r.status, 201);
    moreIds.push(r.data.id);
  }
  assert.equal(
    (await call('artist-songs?page=2&pageSize=10', undefined, a.token)).data
      .items.length,
    3,
  );
  assert.equal(
    (await call('artist-songs?q=Luces', undefined, a.token)).data.total,
    1,
  );
  assert.equal(
    (await call('artist-songs?estado=borrador', undefined, a.token)).data.total,
    12,
  );
  const dash = await call('artist-songs/dashboard', undefined, a.token);
  assert.deepEqual(dash.data.totals, {
    total: 13,
    published: 1,
    drafts: 12,
    releases: 1,
  });
  const outside = await call('artist-songs', undefined, b.token);
  assert.equal(outside.data.total, 0);
  const currentOptions = (
    await call('artist-songs/options', undefined, a.token)
  ).data;
  assert.equal(
    currentOptions.releases.some((r) => r.id === foreignRelease),
    false,
  );
  assert.equal(
    (
      await upload(
        id,
        'audio',
        a.token,
        Buffer.alloc(50 * 1024 * 1024 + 1),
        'audio/wav',
        'too-large.wav',
      )
    ).status,
    413,
  );
  const filename = audioUrl.split('/').pop();
  assert((await stat('uploads/songs/' + filename)).size > 0);
  const demoAfter = await ds.query(
    `SELECT a.* FROM artistas a JOIN usuarios u ON u.id=a.usuario_id WHERE u.email='demo.artista@example.com'`,
  );
  assert.deepEqual(demoAfter, demoBefore);
  await writeFile('../tmp/cu05-real.wav', wav());
  await writeFile('../tmp/cu05-cover.png', image);
  await writeFile(
    '../tmp/cu05-fixture.json',
    JSON.stringify({
      artist: a,
      other: b,
      client,
      noProfile,
      id,
      moreIds,
      ownRelease,
      foreignRelease,
      genre,
    }),
    { mode: 0o600 },
  );
  console.log(
    'CU05 POSTGRESQL OK: borrador, audio WAV real/duración, portada 1200 px, publicación y retirada, permisos 401/403/404, lanzamiento ajeno, validaciones, límite 50 MB, descarga privada, búsqueda, filtros, paginación, re-login y métricas reales. Perfil demo conservado en su estado actual. Fixtures conservadas.',
  );
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  if (ds.isInitialized) await ds.destroy();
}
