/* ===== Horario de clases (editable: agregar, editar, eliminar períodos) ===== */
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
let HOR = [];
const colCurso = c => / II$/.test(c) ? '#38bdf8' : / I$/.test(c) ? '#22c55e' : c ? '#a78bfa' : '#26305a';
const hhmm = () => { const n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0') };
function ahora(filas) {
  const d = (new Date().getDay() + 6) % 7, t = hhmm(); if (d == 6) return 'Domingo: sin clases';
  const f = filas.find(f => f.tipo == 'clase' && f.inicio <= t && t < f.fin);
  return f ? (f['d' + (d + 1)] || 'Libre') : 'Fuera de horario';
}
async function horv() {
  const { filas, cfg } = await api('horario'); HOR = filas; const hoyD = (new Date().getDay() + 6) % 7, t = hhmm();
  const bt = f => `<button class="g" onclick="horf(${f.id})">✏️</button> <button class="r" onclick="hord(${f.id})">🗑️</button>`;
  $('#main').innerHTML = `<h3>Horario de clases 2026</h3>
  <div class="card" style="margin-bottom:14px;display:flex;gap:18px;flex-wrap:wrap;justify-content:space-between;align-items:center">
   <span>Turno: <b>${esc(cfg.turno)}</b> &nbsp;·&nbsp; Semestre: <b>${esc(cfg.semestre)}</b><br>Especialidad: <b>${esc(cfg.especialidad)}</b></span>
   <button class="g" onclick="cfgf()">✏️ Editar datos</button></div>
  <div class="bar"><button onclick="horf()">➕ Agregar período</button></div>
  <div class="card" style="overflow:auto"><table class="hor"><tr><th>Período</th><th>Hora</th>${DIAS.map((x, i) => `<th class="${i == hoyD ? 'hoy' : ''}">${x}${i == hoyD ? ' (hoy)' : ''}</th>`).join('')}<th></th></tr>
  ${filas.map(f => f.tipo == 'recreo' ? `<tr><td colspan="8" class="rec">☕ ${esc(f.etiqueta)} · ${f.inicio} a ${f.fin} &nbsp; ${bt(f)}</td></tr>` :
    `<tr class="${f.inicio <= t && t < f.fin ? 'now' : ''}"><td><b>${esc(f.etiqueta)}</b></td><td>${f.inicio}<br>${f.fin}</td>
    ${[1, 2, 3, 4, 5, 6].map(i => `<td class="${i - 1 == hoyD ? 'hoy' : ''}"><div class="cel" style="--c:${colCurso(f['d' + i])}">${esc(f['d' + i]) || '—'}</div></td>`).join('')}<td style="white-space:nowrap">${bt(f)}</td></tr>`).join('')}
  </table></div><p style="color:var(--m);margin-top:10px">Verde: Técnico Medio I · Azul: Técnico Medio II · La fila resaltada es el período en curso.</p>`;
}
function horf(id) {
  const f = HOR.find(x => x.id == id) || { etiqueta: '', tipo: 'clase', inicio: '', fin: '', d1: '', d2: '', d3: '', d4: '', d5: '', d6: '' };
  const cs = [...new Set(['Técnico Medio I', 'Técnico Medio II', ...HOR.flatMap(h => [1, 2, 3, 4, 5, 6].map(i => h['d' + i])).filter(Boolean)])];
  M(`<h3>${id ? 'Editar' : 'Nuevo'} período</h3><datalist id="cursos">${cs.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
  <label>Nombre (ej: 1°, 2°, Recreo)<input id="h_etiqueta" value="${esc(f.etiqueta)}"></label>
  <label>Tipo<select id="h_tipo"><option value="clase" ${f.tipo == 'clase' ? 'selected' : ''}>Clase</option><option value="recreo" ${f.tipo == 'recreo' ? 'selected' : ''}>Recreo / descanso</option></select></label>
  <div class="rep"><label>Inicio<input type="time" id="h_inicio" value="${f.inicio}"></label><label>Fin<input type="time" id="h_fin" value="${f.fin}"></label></div>
  ${DIAS.map((x, i) => `<label>${x}<input list="cursos" id="h_d${i + 1}" value="${esc(f['d' + (i + 1)])}" placeholder="Curso o materia"></label>`).join('')}
  <div class="act"><button class="g" onclick="X()">Cancelar</button><button onclick="hors(${id || 0})">Guardar</button></div>`);
}
async function hors(id) {
  const d = {}; ['etiqueta', 'tipo', 'inicio', 'fin', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'].forEach(k => d[k] = $('#h_' + k).value);
  if (!d.etiqueta || !d.inicio || !d.fin) return alert('Completa nombre, hora de inicio y fin');
  await api('horario' + (id ? '/' + id : ''), id ? 'PUT' : 'POST', d); X(); horv();
}
async function hord(id) { if (confirm('¿Eliminar este período?')) { await api('horario/' + id, 'DELETE'); horv() } }
async function cfgf() {
  const { cfg } = await api('horario');
  M(`<h3>Datos del horario</h3>${['turno', 'semestre', 'especialidad'].map(k => `<label>${k[0].toUpperCase() + k.slice(1)}<input id="c_${k}" value="${esc(cfg[k])}"></label>`).join('')}
  <div class="act"><button class="g" onclick="X()">Cancelar</button><button onclick="cfgs()">Guardar</button></div>`);
}
async function cfgs() { const d = {}; ['turno', 'semestre', 'especialidad'].forEach(k => d[k] = $('#c_' + k).value); await api('config', 'PUT', d); X(); horv() }
