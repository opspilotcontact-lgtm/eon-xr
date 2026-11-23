// Poderes de dios de F0 (clima). Compartido por la vista y la simulación (sin three.js).
// radio en grados sobre la esfera; T en °C; H en humedad (0–1); mar en unidades de elevación (global).
export const PODERES = {
  sequia: { nombre: 'Sequía', color: '#e0a040', radio: 32, T: 6, H: -0.65, mar: 0 },
  diluvio: { nombre: 'Diluvio', color: '#4aa8ff', radio: 32, T: -2, H: 0.6, mar: 0.05 },
  helada: { nombre: 'Helada', color: '#cfe8ff', radio: 30, T: -24, H: 0, mar: 0 },
  sol: { nombre: 'Sol abrasador', color: '#ff5a2a', radio: 30, T: 18, H: -0.2, mar: 0 },
};
