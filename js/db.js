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