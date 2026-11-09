// Protección simple del panel (NO es seguridad real, solo evita curiosos)
const PIN = '1234';
if (prompt('PIN del investigador:') !== PIN) {
  document.body.innerHTML = '<p style="padding:30px">Acceso denegado.</p>';
  throw new Error('PIN incorrecto');
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const media = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;

function render() {
  const datos = DB.todos();
  const body = $('tabla-body');
  body.innerHTML = '';
  $('detalle').style.display = 'none';
  $('vacio').style.display = datos.length ? 'none' : 'block';

  // Estadísticas generales
  const tarjeta = (v, e) =>
    `<div class="tarjeta"><div class="valor">${v}</div><div class="etiqueta">${e}</div></div>`;
  $('estadisticas').innerHTML =
    tarjeta(datos.length, 'Participantes') +
    tarjeta(datos.length ? (datos.reduce((a, d) => a + d.resumen.span, 0) / datos.length).toFixed(1) : '-', 'Span promedio') +
    tarjeta(media(datos.map(d => d.resumen.latenciaMediaMs)) + ' ms', 'Latencia media global') +
    tarjeta(media(datos.map(d => d.resumen.tiempoRespuestaMedioMs)) + ' ms', 'T. respuesta medio global');

  [...datos].reverse().forEach(d => {
    const r = d.resumen;
    const tr = document.createElement('tr');
    tr.className = 'fila';
    tr.innerHTML = `
      <td>${new Date(d.fecha).toLocaleString('es-MX')}</td>
      <td>${esc(d.participante.nombre)}</td>
      <td>${esc(d.participante.idParticipante)}</td>
      <td>${esc(d.participante.edad)}</td>
      <td>${esc(d.modo)}</td>
      <td>${r.span}</td>
      <td>${r.puntajeTotal}</td>
      <td>${r.ensayosCorrectos}/${r.ensayosTotales}</td>
      <td>${r.erroresTotales}</td>
      <td>${r.latenciaInicialMediaMs}</td>
      <td>${r.latenciaMediaMs}</td>
      <td>${r.tiempoRespuestaMedioMs}</td>
      <td><button class="peligro" data-borrar="${d.id}">X</button></td>`;
    tr.addEventListener('click', (e) => {
      if (e.target.dataset.borrar) return;
      verDetalle(d);
    });
    body.appendChild(tr);
  });

  body.querySelectorAll('[data-borrar]').forEach(b =>
    b.addEventListener('click', () => {
      if (confirm('¿Borrar este resultado?')) { DB.borrarUno(b.dataset.borrar); render(); }
    }));
}

function verDetalle(d) {
  $('detalle').style.display = 'block';
  $('detalle-titulo').textContent =
    `Detalle: ${d.participante.nombre} (ID ${d.participante.idParticipante})`;
  $('detalle-body').innerHTML = d.ensayos.map(e => `
    <tr>
      <td>${e.numero}</td>
      <td>${e.longitud}</td>
      <td>${e.esperado.map(n => n + 1).join(' - ')}</td>
      <td>${e.respuestas.map(r => r.bloque + 1).join(' - ')}</td>
      <td class="${e.acierto ? 'ok' : 'mal'}">${e.acierto ? 'Correcto' : 'Error'}</td>
      <td>${e.errores}</td>
      <td>${e.latenciaInicialMs}</td>
      <td>${e.latenciaMediaMs}</td>
      <td>${e.tiempoRespuestaMs}</td>
    </tr>`).join('');
  $('detalle').scrollIntoView({ behavior: 'smooth' });
}

// ---------- Exportar CSV ----------
function descargarCSV(nombre, filas) {
  const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM para Excel
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

$('btn-csv-resumen').addEventListener('click', () => {
  const filas = [['fecha', 'nombre', 'id', 'edad', 'modo', 'span', 'puntaje', 'ensayos_correctos',
                  'ensayos_totales', 'errores', 'precision_pct', 'latencia_inicial_ms',
                  'latencia_media_ms', 'tiempo_respuesta_ms']];
  DB.todos().forEach(d => {
    const r = d.resumen;
    filas.push([d.fecha, d.participante.nombre, d.participante.idParticipante, d.participante.edad,
      d.modo, r.span, r.puntajeTotal, r.ensayosCorrectos, r.ensayosTotales, r.erroresTotales,
      r.precisionPct, r.latenciaInicialMediaMs, r.latenciaMediaMs, r.tiempoRespuestaMedioMs]);
  });
  descargarCSV('corsi_resumen.csv', filas);
});

$('btn-csv-ensayos').addEventListener('click', () => {
  const filas = [['id', 'nombre', 'modo', 'ensayo', 'longitud', 'secuencia_esperada', 'respuesta',
                  'acierto', 'errores', 'latencia_inicial_ms', 'latencia_media_ms',
                  'tiempo_respuesta_ms', 'latencias_por_clic_ms']];
  DB.todos().forEach(d => d.ensayos.forEach(e => filas.push([
    d.participante.idParticipante, d.participante.nombre, d.modo, e.numero, e.longitud,
    e.esperado.map(n => n + 1).join('-'), e.respuestas.map(r => r.bloque + 1).join('-'),
    e.acierto ? 1 : 0, e.errores, e.latenciaInicialMs, e.latenciaMediaMs, e.tiempoRespuestaMs,
    e.respuestas.map(r => r.latenciaMs).join('|')
  ])));
  descargarCSV('corsi_ensayos.csv', filas);
});

$('btn-borrar-todo').addEventListener('click', () => {
  if (confirm('Esto borra TODOS los resultados. ¿Continuar?')) { DB.borrarTodo(); render(); }
});

render();