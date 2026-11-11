// Guardado de resultados en el navegador (localStorage)
const DB = {
  KEY: 'corsi_resultados_v1',

  todos() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch (e) { return []; }
  },

  agregar(registro) {
    const lista = this.todos();
    lista.push(registro);
    localStorage.setItem(this.KEY, JSON.stringify(lista));
  },

  borrarUno(id) {
    const lista = this.todos().filter(r => r.id !== id);
    localStorage.setItem(this.KEY, JSON.stringify(lista));
  },

  borrarTodo() {
    localStorage.removeItem(this.KEY);
  }
};

// Configuración de la prueba (se edita en el formulario de registro)
const Config = {
  KEY: 'corsi_config_v1',

  porDefecto: {
    msEncendido: 700,      // tiempo que cada cuadro permanece iluminado
    msPausa: 350,          // pausa antes de iluminar el siguiente cuadro
    numBloques: 9,         // cuadros en el tablero (3 a 9)
    nivelInicial: 2,       // longitud de la primera secuencia
    nivelMaximo: 9,        // longitud máxima
    ensayosPorNivel: 2,    // intentos por longitud
    colorEncendido: '#facc15',
    sonido: true,          // sonido al iluminar y al hacer clic
    colores: ['#3b82f6', '#3b82f6', '#3b82f6', '#3b82f6', '#3b82f6',
              '#3b82f6', '#3b82f6', '#3b82f6', '#3b82f6']
  },

  cargar() {
    try {
      return { ...this.porDefecto, ...JSON.parse(localStorage.getItem(this.KEY)) };
    } catch (e) {
      return { ...this.porDefecto };
    }
  },

  guardar(cfg) {
    localStorage.setItem(this.KEY, JSON.stringify(cfg));
  },

  restaurar() {
    localStorage.removeItem(this.KEY);
  }
};