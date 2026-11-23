// Regalos: intervenciones con objetivo («a quién» + «qué»). Se sueltan sobre el valle.
// objetivo: 'fauna' (los animales dominantes) o 'pueblo' (el pueblo más cercano a donde soltás).
// Compartido por la vista y la simulación del valle (sin three.js).
export const REGALOS = {
  festin: { nombre: 'Festín', color: '#8fd16a', objetivo: 'ambos', ayuda: 'Comida de sobra para los animales o para un pueblo' },
  depredador: { nombre: 'Depredadores', color: '#c0392b', objetivo: 'fauna', ayuda: 'Más cazadores entre los animales' },
  plaga: { nombre: 'Plaga', color: '#9b6ad1', objetivo: 'pueblo', ayuda: 'Una enfermedad para el pueblo más cercano' },
  bomba: { nombre: 'Bomba atómica', color: '#ffe14a', objetivo: 'pueblo', ayuda: 'Se la das al pueblo más cercano. Él decide qué hace con ella' },
};

// hoy la simulación solo usa reglas; aquí entrará la petición libre a Claude («¿qué pasa si…?»),
// que devolverá un regalo existente o cambios de variables con la misma forma que los eventos de sim.js
export const PETICION_LIBRE = null;
