// ================== CONFIGURACIÓN ==================
const NIVEL_INICIAL = 2;     // longitud de la primera secuencia
const NIVEL_MAXIMO = 9;      // longitud máxima
const ENSAYOS_POR_NIVEL = 2; // intentos por longitud
const MS_ENCENDIDO = 700;    // tiempo que se ilumina cada bloque
const MS_PAUSA = 350;        // pausa entre bloques

// Posiciones (% left, % top) de los 9 bloques dentro del tablero
const POSICIONES = [
  [8, 8], [40, 4], [76, 10],
  [22, 38], [56, 40], [84, 48],
  [6, 70], [40, 74], [72, 70]
];

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

// ================== TABLERO ==================
function crearTablero() {
  const tablero = $('tablero');
  tablero.innerHTML = '';
  POSICIONES.forEach(([x, y], i) => {
    const b = document.createElement('button');
    b.className = 'bloque';
    b.dataset.i = i;
    b.style.left = x + '%';
    b.style.top = y + '%';
    b.addEventListener('pointerdown', () => alClickBloque(i, b));
    tablero.appendChild(b);
  });
  tablero.classList.add('bloqueado');
}

function bloque(i) { return $('tablero').children[i]; }

// ================== FLUJO ==================
$('form-registro').addEventListener('submit', (e) => {
  e.preventDefault();
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
  mostrarPantalla('pantalla-registro');
});

async function iniciarPrueba() {
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
  const indices = [...Array(POSICIONES.length).keys()];
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