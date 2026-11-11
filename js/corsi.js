// ================== CONFIGURACIÓN (se carga con aplicarConfig) ==================
let NIVEL_INICIAL, NIVEL_MAXIMO, ENSAYOS_POR_NIVEL, MS_ENCENDIDO, MS_PAUSA, NUM_BLOQUES, CFG;

// Posiciones (% left, % top) de los 9 bloques dentro del tablero
const POSICIONES = [
  [8, 8], [40, 4], [76, 10],
  [22, 38], [56, 40], [84, 48],
  [6, 70], [40, 74], [72, 70]
];

// Orden en que se usan las posiciones, para que con pocos bloques queden bien repartidos
const ORDEN = [0, 8, 2, 6, 4, 1, 7, 3, 5];

// ================== ESTADO ==================
let participante = null;
let modo = 'directo';
let nivel, ensayoEnNivel, aciertosEnNivel;
let ensayos = [];            // todos los ensayos con sus métricas
let secuencia = [];
let esperado = [];           // secuencia que debe repetir (directa o invertida)
let respuestas = [];         // clics del ensayo actual
let aceptando = false;
let tUltimoEvento = 0;       // referencia para calcular latencias
let tFinSecuencia = 0;

// ================== UTILIDADES ==================
const $ = (id) => document.getElementById(id);
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
const media = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

function mostrarPantalla(id) {
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  $(id).classList.add('activa');
}

function aplicarConfig() {
  CFG = Config.cargar();
  NUM_BLOQUES = Math.min(Math.max(CFG.numBloques, 3), POSICIONES.length);
  NIVEL_MAXIMO = Math.min(CFG.nivelMaximo, NUM_BLOQUES);
  NIVEL_INICIAL = Math.min(CFG.nivelInicial, NIVEL_MAXIMO);
  ENSAYOS_POR_NIVEL = CFG.ensayosPorNivel;
  MS_ENCENDIDO = CFG.msEncendido;
  MS_PAUSA = CFG.msPausa;
  document.documentElement.style.setProperty('--color-encendido', CFG.colorEncendido);
}

// ================== SONIDO ==================
let audioCtx = null;

// Los navegadores solo permiten audio después de un clic del usuario,
// por eso se llama desde el submit del formulario y desde iniciarPrueba
function prepararAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function tono(frecuencia, ms, tipo = 'sine', volumen = 0.15) {
  if (!CFG || !CFG.sonido || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const ganancia = audioCtx.createGain();
  const t = audioCtx.currentTime;
  osc.type = tipo;
  osc.frequency.value = frecuencia;
  ganancia.gain.setValueAtTime(0.0001, t);
  ganancia.gain.exponentialRampToValueAtTime(volumen, t + 0.01);          // ataque suave
  ganancia.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);      // caída
  osc.connect(ganancia);
  ganancia.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

// ================== TABLERO ==================
function crearTablero() {
  const tablero = $('tablero');
  tablero.innerHTML = '';
  const pos = ORDEN.slice(0, NUM_BLOQUES).map(k => POSICIONES[k]);
  pos.forEach(([x, y], i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bloque';
    b.dataset.i = i;
    b.style.left = x + '%';
    b.style.top = y + '%';
    b.style.setProperty('--color', CFG.colores[i]);
    b.addEventListener('pointerdown', () => alClickBloque(i, b));
    tablero.appendChild(b);
  });
  tablero.classList.add('bloqueado');
}

function bloque(i) { return $('tablero').children[i]; }

// ================== CONFIGURACIÓN EN EL FORMULARIO ==================
const CAMPOS_NUM = ['msEncendido', 'msPausa', 'numBloques', 'nivelInicial', 'nivelMaximo', 'ensayosPorNivel'];

// Selectores de color (uno por cuadro)
for (let i = 0; i < 9; i++) {
  const l = document.createElement('label');
  l.innerHTML = `Cuadro ${i + 1}<input type="color" id="color${i}">`;
  $('colores').appendChild(l);
}

function llenarConfig(cfg) {
  CAMPOS_NUM.forEach(id => $(id).value = cfg[id]);
  $('colorEncendido').value = cfg.colorEncendido;
  $('sonido').checked = cfg.sonido;
  cfg.colores.forEach((c, i) => $('color' + i).value = c);
  actualizarColoresVisibles();
}

// Solo se muestran los selectores de color de los cuadros que se van a usar
function actualizarColoresVisibles() {
  const n = parseInt($('numBloques').value, 10) || 9;
  document.querySelectorAll('#colores label').forEach((l, i) =>
    l.classList.toggle('oculto', i >= n));
}
$('numBloques').addEventListener('input', actualizarColoresVisibles);

function errorConfig(texto) {
  $('mensaje-config').textContent = texto;
  $('detalles-config').open = true;
  $('mensaje-config').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Lee y valida la configuración del formulario. Devuelve null si hay error.
function leerConfig() {
  const cfg = {};
  CAMPOS_NUM.forEach(id => cfg[id] = parseInt($(id).value, 10));
  cfg.colorEncendido = $('colorEncendido').value;
  cfg.sonido = $('sonido').checked;
  cfg.colores = Array.from({ length: 9 }, (_, i) => $('color' + i).value);

  if (CAMPOS_NUM.some(id => Number.isNaN(cfg[id]))) {
    errorConfig('Completa todos los campos de la configuración.');
    return null;
  }
  if (cfg.numBloques < 3 || cfg.numBloques > 9) {
    errorConfig('Los cuadros del tablero deben ser entre 3 y 9.');
    return null;
  }
  if (cfg.nivelMaximo > cfg.numBloques) {
    errorConfig('La longitud máxima no puede ser mayor que los cuadros del tablero.');
    return null;
  }
  if (cfg.nivelInicial > cfg.nivelMaximo) {
    errorConfig('La longitud inicial no puede ser mayor que la máxima.');
    return null;
  }
  $('mensaje-config').textContent = '';
  return cfg;
}

$('btn-restaurar').addEventListener('click', () => {
  Config.restaurar();
  llenarConfig(Config.cargar());
  $('mensaje-config').textContent = '';
});

// Si un campo del formulario es inválido, abre la sección para que se vea el error
$('form-registro').addEventListener('invalid', () => {
  $('detalles-config').open = true;
}, true);

llenarConfig(Config.cargar());   // al abrir la página, muestra la última configuración usada

// ================== FLUJO ==================
$('form-registro').addEventListener('submit', (e) => {
  e.preventDefault();
  const cfg = leerConfig();
  if (!cfg) return;
  Config.guardar(cfg);
  aplicarConfig();
  prepararAudio();

  participante = {
    nombre: $('nombre').value.trim(),
    idParticipante: $('idParticipante').value.trim(),
    edad: parseInt($('edad').value, 10)
  };
  modo = $('modo').value;
  $('texto-modo').textContent = modo === 'directo'
    ? 'Cuando termine la secuencia, toca los bloques en el MISMO orden.'
    : 'Cuando termine la secuencia, toca los bloques en orden INVERSO (del último al primero).';
  mostrarPantalla('pantalla-instrucciones');
});

$('btn-empezar').addEventListener('click', iniciarPrueba);
$('btn-nuevo').addEventListener('click', () => {
  $('form-registro').reset();
  llenarConfig(Config.cargar());
  mostrarPantalla('pantalla-registro');
});

async function iniciarPrueba() {
  aplicarConfig();
  prepararAudio();
  nivel = NIVEL_INICIAL;
  ensayoEnNivel = 0;
  aciertosEnNivel = 0;
  ensayos = [];
  crearTablero();
  mostrarPantalla('pantalla-juego');
  $('estado').textContent = 'Prepárate...';
  await esperar(1500);
  siguienteEnsayo();
}

function generarSecuencia(n) {
  const indices = [...Array(NUM_BLOQUES).keys()];
  for (let i = indices.length - 1; i > 0; i--) {      // Fisher-Yates
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, n);
}

async function siguienteEnsayo() {
  secuencia = generarSecuencia(nivel);
  esperado = modo === 'directo' ? [...secuencia] : [...secuencia].reverse();
  respuestas = [];
  aceptando = false;
  $('tablero').classList.add('bloqueado');
  $('estado').textContent = 'Observa la secuencia...';
  await esperar(800);

  for (const i of secuencia) {
    bloque(i).classList.add('encendido');
    tono(523, MS_ENCENDIDO);                       // sonido al iluminarse
    await esperar(MS_ENCENDIDO);
    bloque(i).classList.remove('encendido');
    await esperar(MS_PAUSA);
  }

  $('estado').textContent = 'Tu turno';
  $('tablero').classList.remove('bloqueado');
  aceptando = true;
  tFinSecuencia = performance.now();   // aquí empieza a contar el tiempo de respuesta
  tUltimoEvento = tFinSecuencia;
}

// ================== RESPUESTA DEL PARTICIPANTE ==================
function alClickBloque(i, el) {
  if (!aceptando) return;
  const ahora = performance.now();
  const pos = respuestas.length;
  const correcto = i === esperado[pos];

  respuestas.push({
    posicion: pos + 1,
    bloque: i,
    esperado: esperado[pos],
    correcto: correcto,
    latenciaMs: Math.round(ahora - tUltimoEvento) // desde el clic anterior (o fin de secuencia)
  });
  tUltimoEvento = ahora;
  tono(880, 90, 'triangle', 0.2);                  // sonido al hacer clic (igual si acierta o falla)

  el.classList.add('tap');
  setTimeout(() => el.classList.remove('tap'), 150);

  // El ensayo termina al primer error o al completar la secuencia
  if (!correcto || respuestas.length === esperado.length) {
    terminarEnsayo(ahora);
  }
}

async function terminarEnsayo(tFin) {
  aceptando = false;
  $('tablero').classList.add('bloqueado');

  const errores = respuestas.filter(r => !r.correcto).length;
  const acierto = errores === 0 && respuestas.length === esperado.length;

  ensayos.push({
    numero: ensayos.length + 1,
    longitud: nivel,
    secuencia: [...secuencia],
    esperado: [...esperado],
    respuestas: respuestas,
    acierto: acierto,
    errores: errores,
    latenciaInicialMs: respuestas[0].latenciaMs,                       // tiempo hasta el 1er clic
    latenciaMediaMs: Math.round(media(respuestas.map(r => r.latenciaMs))),
    tiempoRespuestaMs: Math.round(tFin - tFinSecuencia)                // tiempo total de respuesta
  });

  $('estado').textContent = '';
  await esperar(900);

  // ---- Reglas de avance ----
  if (acierto) aciertosEnNivel++;
  ensayoEnNivel++;

  if (ensayoEnNivel >= ENSAYOS_POR_NIVEL) {
    if (aciertosEnNivel === 0) return finalizar();          // falló todos los de este nivel
    if (nivel >= NIVEL_MAXIMO) return finalizar();          // llegó al máximo
    nivel++;
    ensayoEnNivel = 0;
    aciertosEnNivel = 0;
  }
  siguienteEnsayo();
}

// ================== RESULTADOS ==================
function calcularResumen() {
  const correctos = ensayos.filter(e => e.acierto);
  const span = correctos.length ? Math.max(...correctos.map(e => e.longitud)) : 0;
  const clics = ensayos.flatMap(e => e.respuestas);

  return {
    span: span,
    ensayosTotales: ensayos.length,
    ensayosCorrectos: correctos.length,
    erroresTotales: ensayos.reduce((a, e) => a + e.errores, 0),
    puntajeTotal: span * correctos.length,                        // puntaje Corsi clásico
    precisionPct: Math.round((correctos.length / ensayos.length) * 100),
    latenciaInicialMediaMs: Math.round(media(ensayos.map(e => e.latenciaInicialMs))),
    latenciaMediaMs: Math.round(media(clics.map(c => c.latenciaMs))),
    tiempoRespuestaMedioMs: Math.round(media(ensayos.map(e => e.tiempoRespuestaMs)))
  };
}

function finalizar() {
  const resumen = calcularResumen();

  DB.agregar({
    id: 'r_' + Date.now(),
    fecha: new Date().toISOString(),
    participante: participante,
    modo: modo,
    config: CFG,
    resumen: resumen,
    ensayos: ensayos
  });

  const t = (valor, etiqueta) =>
    `<div class="tarjeta"><div class="valor">${valor}</div><div class="etiqueta">${etiqueta}</div></div>`;

  $('resumen').innerHTML = `
    <p>Gracias, <strong>${participante.nombre.replace(/</g, '&lt;')}</strong>. Estos son tus resultados:</p>
    <div class="tarjetas">
      ${t(resumen.span, 'Amplitud (span)')}
      ${t(resumen.puntajeTotal, 'Puntaje total')}
      ${t(resumen.ensayosCorrectos + ' / ' + resumen.ensayosTotales, 'Ensayos correctos')}
      ${t(resumen.erroresTotales, 'Errores')}
      ${t(resumen.latenciaInicialMediaMs + ' ms', 'Latencia inicial media')}
      ${t(resumen.latenciaMediaMs + ' ms', 'Latencia media por clic')}
      ${t(resumen.tiempoRespuestaMedioMs + ' ms', 'Tiempo de respuesta medio')}
    </div>`;
  mostrarPantalla('pantalla-resultados');
}