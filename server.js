// Servidor Node.js + SQLite (archivo cea.db). Sin dependencias: solo Node 22.5 o superior.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const DBF = path.join(__dirname, 'cea.db'), db = new DatabaseSync(DBF);
const EQK = ['nombre', 'cpu', 'monitor', 'cortapico', 'mouse', 'teclado', 'parlante', 'audifono', 'estado', 'notas'];
const HK = ['etiqueta', 'inicio', 'fin', 'tipo', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'];
const hs = p => crypto.createHash('sha256').update(p).digest('hex');
const hoy = () => new Date().toISOString().slice(0, 10);
const q = (s, ...a) => db.prepare(s).all(...a);
const ex = (s, ...a) => Number(db.prepare(s).run(...a).lastInsertRowid);

db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, nombre TEXT, usuario TEXT UNIQUE, clave TEXT);
CREATE TABLE IF NOT EXISTS equipos(id INTEGER PRIMARY KEY, nombre TEXT, cpu TEXT DEFAULT '', monitor TEXT DEFAULT '',
  cortapico INT DEFAULT 1, mouse INT DEFAULT 1, teclado INT DEFAULT 1, parlante INT DEFAULT 1, audifono INT DEFAULT 1,
  estado TEXT DEFAULT 'Óptimo', notas TEXT DEFAULT '', ultimo_mant TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS incidencias(id INTEGER PRIMARY KEY, equipo_id INT, titulo TEXT, descripcion TEXT,
  prioridad TEXT, estado TEXT DEFAULT 'Abierta', fecha TEXT, autor TEXT);
CREATE TABLE IF NOT EXISTS registros(id INTEGER PRIMARY KEY, equipo_id INT, tipo TEXT, detalle TEXT,
  fecha TEXT, proximo TEXT, autor TEXT);
CREATE TABLE IF NOT EXISTS horario(id INTEGER PRIMARY KEY, etiqueta TEXT, inicio TEXT, fin TEXT, tipo TEXT DEFAULT 'clase',
  d1 TEXT DEFAULT '', d2 TEXT DEFAULT '', d3 TEXT DEFAULT '', d4 TEXT DEFAULT '', d5 TEXT DEFAULT '', d6 TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS config(k TEXT PRIMARY KEY, v TEXT);`);
if (!q('SELECT 1 FROM horario').length) {
  const I = 'Técnico Medio I', II = 'Técnico Medio II', A = [I, II, I, II, I, II], B = [II, I, II, I, II, I];
  [['1°', '18:00', '18:40', 'clase', A], ['2°', '18:40', '19:20', 'clase', A], ['Recreo / descanso', '19:20', '19:30', 'recreo', []],
   ['3°', '19:30', '20:10', 'clase', B], ['4°', '20:10', '20:50', 'clase', B], ['5°', '20:50', '21:30', 'clase', B]]
    .forEach(([e, i, f, t, d]) => ex(`INSERT INTO horario(${HK}) VALUES(${HK.map(() => '?')})`, e, i, f, t, ...[0, 1, 2, 3, 4, 5].map(n => d[n] || '')));
  [['turno', 'Noche'], ['semestre', 'Segundo'], ['especialidad', 'Tecnología de la Información Digital']].forEach(([k, v]) => ex('INSERT INTO config(k,v) VALUES(?,?)', k, v));
}
if (!q('SELECT 1 FROM users').length) {
  [['Yhonatan Soto Mamani', 'yhonatan', 'yhonatan2026'], ['Jose Luis Huanca Mamani', 'joseluis', 'joseluis2026']]
    .forEach(([n, u, p]) => ex('INSERT INTO users(nombre,usuario,clave) VALUES(?,?,?)', n, u, hs(p)));
  for (let i = 1; i <= 17; i++) ex('INSERT INTO equipos(nombre,parlante) VALUES(?,?)', 'PC' + i, [3, 7, 9, 12, 15].includes(i) ? 0 : 1);
}

const S = new Map();
function api(k, id, b, U, sid) {
  if (k == 'POST login') {
    const r = q('SELECT * FROM users WHERE usuario=?', String(b.usuario || '').trim().toLowerCase())[0];
    if (r && r.clave == hs(String(b.clave || ''))) { S.set(sid, r.nombre); return { ok: 1, nombre: r.nombre } }
    return { error: 'Usuario o contraseña incorrectos' };
  }
  if (k == 'POST logout') { S.delete(sid); return { ok: 1 } }
  if (k == 'GET me') return { nombre: U || null };
  if (!U) return { error: 'No autorizado' };
  switch (k) {
    case 'GET equipos': return q('SELECT * FROM equipos ORDER BY id');
    case 'POST equipos': return { id: ex(`INSERT INTO equipos(${EQK}) VALUES(${EQK.map(() => '?')})`, ...EQK.map(c => b[c] ?? (['cpu', 'monitor', 'notas'].includes(c) ? '' : c == 'estado' ? 'Óptimo' : 1))) };
    case 'PUT equipos': ex(`UPDATE equipos SET ${EQK.map(c => c + '=?')} WHERE id=?`, ...EQK.map(c => b[c] ?? ''), id); return { ok: 1 };
    case 'DELETE equipos': ['incidencias', 'registros'].forEach(t => ex(`DELETE FROM ${t} WHERE equipo_id=?`, id)); ex('DELETE FROM equipos WHERE id=?', id); return { ok: 1 };
    case 'GET incidencias': return q('SELECT i.*, e.nombre equipo FROM incidencias i LEFT JOIN equipos e ON e.id=i.equipo_id ORDER BY i.id DESC');
    case 'POST incidencias': return { id: ex('INSERT INTO incidencias(equipo_id,titulo,descripcion,prioridad,fecha,autor) VALUES(?,?,?,?,?,?)', b.equipo_id, b.titulo, b.descripcion || '', b.prioridad || 'Media', hoy(), U) };
    case 'PUT incidencias': ex('UPDATE incidencias SET estado=? WHERE id=?', b.estado, id); return { ok: 1 };
    case 'DELETE incidencias': ex('DELETE FROM incidencias WHERE id=?', id); return { ok: 1 };
    case 'GET registros': return q('SELECT r.*, e.nombre equipo FROM registros r LEFT JOIN equipos e ON e.id=r.equipo_id ORDER BY r.id DESC');
    case 'POST registros':
      ex('INSERT INTO registros(equipo_id,tipo,detalle,fecha,proximo,autor) VALUES(?,?,?,?,?,?)', b.equipo_id, b.tipo, b.detalle || '', hoy(), b.proximo || '', U);
      if (b.nuevo_estado) ex('UPDATE equipos SET estado=? WHERE id=?', b.nuevo_estado, b.equipo_id);
      if (['Preventivo', 'Correctivo', 'Actualización'].includes(b.tipo)) ex('UPDATE equipos SET ultimo_mant=? WHERE id=?', hoy(), b.equipo_id);
      return { ok: 1 };
    case 'GET horario': return { filas: q('SELECT * FROM horario ORDER BY inicio'), cfg: Object.fromEntries(q('SELECT * FROM config').map(r => [r.k, r.v])) };
    case 'POST horario': return { id: ex(`INSERT INTO horario(${HK}) VALUES(${HK.map(() => '?')})`, ...HK.map(c => b[c] ?? '')) };
    case 'PUT horario': ex(`UPDATE horario SET ${HK.map(c => c + '=?')} WHERE id=?`, ...HK.map(c => b[c] ?? ''), id); return { ok: 1 };
    case 'DELETE horario': ex('DELETE FROM horario WHERE id=?', id); return { ok: 1 };
    case 'PUT config': Object.entries(b).forEach(([k, v]) => ex('INSERT OR REPLACE INTO config(k,v) VALUES(?,?)', k, String(v))); return { ok: 1 };
    case 'DELETE registros': ex('DELETE FROM registros WHERE id=?', id); return { ok: 1 };
  }
  return { error: 'Ruta no válida' };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpeg': 'image/jpeg', '.png': 'image/png' };
http.createServer((req, res) => {
  const url = req.url.split('?')[0], ck = /sid=(\w+)/.exec(req.headers.cookie || ''), hdr = {};
  let sid = ck ? ck[1] : crypto.randomBytes(16).toString('hex'); if (!ck) hdr['Set-Cookie'] = `sid=${sid}; Path=/; HttpOnly`;
  if (url.startsWith('/api/')) {
    let raw = ''; req.on('data', c => raw += c);
    return req.on('end', () => {
      const [p, id] = url.slice(5).split('/'); let out;
      try { out = api(req.method + ' ' + p, id ? +id : null, raw ? JSON.parse(raw) : {}, S.get(sid), sid) } catch (e) { out = { error: e.message } }
      res.writeHead(200, { ...hdr, 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
    });
  }
  const f = path.join(__dirname, url == '/' ? 'index.html' : url);
  if (!/^\/(index\.html|css\/[\w.-]+|js\/[\w.-]+|img\/[\w.-]+)?$/.test(url) || !f.startsWith(__dirname) || !/\.(html|css|js|jpeg|png)$/.test(f) || !fs.existsSync(f)) { res.writeHead(404); return res.end('No encontrado') }
  res.writeHead(200, { ...hdr, 'Content-Type': MIME[path.extname(f)] }); res.end(fs.readFileSync(f));
}).listen(3000, () => console.log('\n>>> Sistema listo: http://localhost:3000   (base de datos: cea.db)\n'));
