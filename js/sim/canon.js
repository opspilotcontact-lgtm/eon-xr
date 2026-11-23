// La línea real de la Tierra como datos: el reloj de la partida (p ∈ [0,1]) y lo que la historia
// canónica impone en cada momento (temperatura global, magma, océanos, oxígeno, vida…), más
// las cifras y curiosidades que enseña el panel. Puro: sin three.js ni DOM.
// Las cifras son aproximaciones divulgativas (órdenes de magnitud), no datos de precisión.

export const EDAD_TIERRA = 4.5e9;

// p → años atrás. Logarítmico por tramos: cada era recibe un trozo de partida parecido.
// Tocar estas anclas cambia el ritmo de toda la partida.
export const ANCLAS = [
  [0.00, 4.5e9],   // nace la Tierra
  [0.10, 2.4e9],   // Hádico + Arcaico
  [0.18, 5.4e8],   // Proterozoico
  [0.32, 6.6e7],   // Paleozoico + Mesozoico
  [0.45, 3.0e5],   // Cenozoico
  [0.60, 1.2e4],   // Paleolítico
  [0.80, 500],     // Neolítico → Edad Media
  [1.00, 0],       // hoy
];
const lg = a => Math.log10(Math.max(0, a) + 1);
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function anosAtras(p) {
  if (p <= 0) return ANCLAS[0][1];
  if (p >= 1) return 0;
  for (let i = 0; i < ANCLAS.length - 1; i++) {
    const [p0, a0] = ANCLAS[i], [p1, a1] = ANCLAS[i + 1];
    if (p <= p1) return Math.pow(10, lerp(lg(a0), lg(a1), (p - p0) / (p1 - p0))) - 1;
  }
  return 0;
}

// inversa: años atrás → p (para dibujar los hitos en la barra)
export function pDe(a) {
  const x = lg(a);
  for (let i = 0; i < ANCLAS.length - 1; i++) {
    const [p0, a0] = ANCLAS[i], [p1, a1] = ANCLAS[i + 1];
    if (a >= a1) return lerp(p0, p1, (lg(a0) - x) / (lg(a0) - lg(a1)));
  }
  return 1;
}

// curva por claves [añosAtrás, valor] ordenadas de más antigua a más reciente, interpolada en log(edad)
function curva(claves, a) {
  if (a >= claves[0][0]) return claves[0][1];
  const x = lg(a);
  for (let i = 0; i < claves.length - 1; i++) {
    const [a0, v0] = claves[i], [a1, v1] = claves[i + 1];
    if (a >= a1) return lerp(v0, v1, (lg(a0) - x) / (lg(a0) - lg(a1)));
  }
  return claves[claves.length - 1][1];
}
// igual, pero interpolando el logaritmo del valor (para cantidades que crecen por órdenes de magnitud)
function curvaLog(claves, a) {
  return Math.pow(10, curva(claves.map(([e, v]) => [e, Math.log10(Math.max(v, 1e-9))]), a));
}

// diferencia de temperatura global respecto a hoy (°C), de grano grueso
const TEMP = [
  [4.5e9, 80], [4.2e9, 60], [4.0e9, 30], [3.5e9, 20], [2.5e9, 12],
  [2.42e9, 10], [2.38e9, -26], [2.25e9, -26], [2.2e9, 10],            // glaciación huroniana
  [1.0e9, 7], [7.3e8, 6], [7.17e8, -30], [6.4e8, -30], [6.3e8, 8],     // Tierra bola de nieve
  [5.4e8, 9], [4.5e8, 6], [4.45e8, -5], [4.42e8, 6],                   // glaciación ordovícica
  [3.3e8, 2], [3.1e8, -3], [2.7e8, 2], [2.52e8, 12],                   // Karoo y calor del Pérmico
  [2.0e8, 8], [1.0e8, 9], [6.62e7, 8], [6.6e7, -5], [6.55e7, 8],       // invierno del asteroide
  [5.6e7, 13], [5.0e7, 8], [3.4e7, 4], [3.0e6, 1.5], [2.6e6, 0],       // máximo del Eoceno, enfriamiento
];
function deltaT(a) {
  if (a >= 2.6e6) return curva(TEMP, a);
  // ciclos glaciares de ~100.000 años, con el máximo glacial hace 20.000
  const r = suave(2.6e6, 1.5e6, a);
  let t = -3 * r - 3 * r * Math.cos(2 * Math.PI * (a - 2e4) / 1e5);
  t = lerp(t, 0, suave(1.8e4, 1.0e4, a));      // Holoceno
  if (a < 200) t += 1.2 * (1 - a / 200);       // calentamiento industrial
  return t;
}

export function forzamiento(a) {
  return {
    a,
    dT: deltaT(a),
    magma: curva([[4.5e9, 1], [4.35e9, 1], [4.05e9, 0]], a),
    mar: curva([[4.1e9, -1.5], [3.9e9, -0.06], [1e9, -0.03], [0, 0]], a),
    o2: curva([[2.45e9, 0], [2.3e9, 0.45], [6e8, 0.6], [4e8, 1]], a),
    vidaMar: curva([[3.8e9, 0], [3.5e9, 0.15], [2.4e9, 0.3], [5.45e8, 0.5], [5.0e8, 1]], a),
    tierra: a < 4.7e8,   // las plantas salen del agua
  };
}

// ---------- cifras para el panel ----------
export const ESPECIES = [
  [3.8e9, 1], [3.5e9, 10], [2.4e9, 100], [1.0e9, 1000], [5.45e8, 1e4], [5.0e8, 2e5], [3.73e8, 6e5], [3.7e8, 2.5e5],
  [2.53e8, 1.2e6], [2.5e8, 1.2e5], [2.0e8, 8e5], [6.61e7, 3e6], [6.5e7, 8e5], [3e7, 4e6], [0, 8.7e6],
];
export const POBLACION = [
  [3.0e5, 1], [2.9e5, 1e4], [7.0e4, 1e4], [1.2e4, 4e6], [5.0e3, 1.4e7], [2.0e3, 2.5e8], [1.0e3, 2.8e8],
  [5.0e2, 4.5e8], [226, 9e8], [96, 2e9], [76, 2.5e9], [26, 6e9], [0, 8.1e9],
];
const OXIGENO = [[2.45e9, 0], [2.3e9, 2], [8e8, 4], [5.4e8, 12], [3.0e8, 33], [2.5e8, 16], [0, 21]];   // % del aire
const DIA = [[4.5e9, 6], [2.5e9, 15], [1.4e9, 18.7], [6.2e8, 21.9], [4.0e8, 22], [7e7, 23.5], [0, 24]]; // horas

export function cifrasReales(a) {
  return {
    especies: a > 3.8e9 ? 0 : curvaLog(ESPECIES, a),
    poblacion: a > 3.0e5 ? 0 : curvaLog(POBLACION, a),
    oxigeno: curva(OXIGENO, a),
    dia: curva(DIA, a),
    vida: vidaDominante(a),
  };
}

const VIDA = [
  [4.5e9, 'Nada vivo: roca fundida'], [4.05e9, 'Nada vivo todavía'], [3.8e9, 'Primeros microbios en el mar'],
  [2.4e9, 'Tapetes de microbios (estromatolitos)'], [1.6e9, 'Algas y primeras células complejas'],
  [5.7e8, 'Seres blandos de Ediacara'], [5.4e8, 'Trilobites y animales con concha'], [4.7e8, 'Peces y primeras plantas'],
  [3.6e8, 'Anfibios y bosques de helechos gigantes'], [3.0e8, 'Insectos gigantes y reptiles'],
  [2.3e8, 'Dinosaurios'], [6.6e7, 'Mamíferos tras el asteroide'], [6.0e6, 'Simios y primeros homínidos'],
  [3.0e5, 'Homo sapiens y neandertales'], [4.0e4, 'Homo sapiens'], [1.2e4, 'Humanos agricultores'], [200, 'Humanos en ciudades e industrias'],
];
export function vidaDominante(a) {
  let txt = VIDA[0][1];
  for (const [e, t] of VIDA) if (a <= e) txt = t;
  return txt;
}

const ERAS = [
  [4.0e9, 'Hádico'], [2.5e9, 'Arcaico'], [5.41e8, 'Proterozoico'], [2.52e8, 'Paleozoico'], [6.6e7, 'Mesozoico'],
  [3.0e5, 'Cenozoico'], [1.2e4, 'Paleolítico'], [5.0e3, 'Neolítico'], [1.55e3, 'Edad Antigua'], [534, 'Edad Media'],
  [237, 'Edad Moderna'], [-1, 'Edad Contemporánea'],
];
export function eraDe(a) {
  for (const [desde, nombre] of ERAS) if (a >= desde) return nombre;
  return ERAS[ERAS.length - 1][1];
}

// hitos: el sol frena al cruzarlos y se anuncian
export const HITOS = [
  { a: 4.0e9, texto: 'Llueve durante millones de años: nacen los océanos' },
  { a: 3.8e9, texto: 'Primera vida: microbios en el mar' },
  { a: 2.4e9, texto: 'Gran Oxidación: el cielo se vuelve azul' },
  { a: 2.3e9, texto: 'Glaciación huroniana: la Tierra casi se congela' },
  { a: 7.2e8, texto: 'Tierra bola de nieve: hielo hasta el ecuador' },
  { a: 5.4e8, texto: 'Explosión cámbrica: el mar se llena de formas' },
  { a: 4.7e8, texto: 'Las plantas salen del agua' },
  { a: 3.75e8, texto: 'Los peces se arrastran a tierra: primeras patas' },
  { a: 2.52e8, texto: 'Gran Mortandad: muere el 90 % de las especies' },
  { a: 2.3e8, texto: 'Aparecen los dinosaurios' },
  { a: 6.6e7, texto: 'Cae el asteroide: fin de los dinosaurios' },
  { a: 6.0e6, texto: 'Nuestros antepasados se separan de los chimpancés' },
  { a: 3.0e5, texto: 'Aparece el Homo sapiens' },
  { a: 2.0e4, texto: 'Máximo glacial: hielo sobre media Europa' },
  { a: 1.17e4, texto: 'Acaba la última glaciación: nace la agricultura' },
  { a: 4.5e3, texto: 'Se levantan las pirámides de Guiza' },
  { a: 2.0e3, texto: 'El Imperio romano domina el Mediterráneo' },
  { a: 534, texto: 'Colón llega a América' },
  { a: 200, texto: 'Revolución industrial: empieza a subir el CO₂' },
  { a: 57, texto: 'El ser humano pisa la Luna' },
];

// extinciones masivas: fracción de la vida en tierra que se pierde al cruzarlas
export const EXTINCIONES = [
  { a: 3.72e8, k: 0.3 }, { a: 2.52e8, k: 0.75 }, { a: 2.01e8, k: 0.4 }, { a: 6.6e7, k: 0.55 },
];

// una curiosidad por tramo: se enseña la del tramo en que estás
const CURIOSIDADES = [
  [4.5e9, 'Un planeta del tamaño de Marte, Tea, chocó con la Tierra joven. De los restos nació la Luna.'],
  [4.3e9, 'La Luna estaba tan cerca que se veía unas 15 veces más grande y las mareas eran de cientos de metros.'],
  [4.0e9, 'Los cristales de circón más antiguos de Australia ya hablan de agua líquida hace 4.400 millones de años.'],
  [3.8e9, 'Toda la vida de hoy desciende de un antepasado común microbiano llamado LUCA.'],
  [3.0e9, 'El cielo no era azul: una neblina de metano lo teñía de naranja, como el de Titán.'],
  [2.4e9, 'Las cianobacterias llenaron el aire de oxígeno, que para la mayoría de la vida de entonces era veneno.'],
  [2.0e9, 'El hierro que se oxidó en los mares formó las bandas rojas que hoy son nuestras minas de hierro.'],
  [1.5e9, 'Una célula se tragó a otra sin digerirla: así nacieron las mitocondrias que hoy te dan energía.'],
  [7.2e8, 'Durante la Tierra bola de nieve los volcanes fueron lo que acabó salvando el planeta: su CO₂ lo descongeló.'],
  [5.4e8, 'En pocos millones de años aparecieron casi todos los planes corporales de los animales actuales.'],
  [4.7e8, 'Las primeras plantas terrestres eran musgos de pocos centímetros, sin raíces ni flores.'],
  [3.75e8, 'Tiktaalik, mitad pez mitad anfibio, tenía cuello y aletas con huesos de muñeca.'],
  [3.0e8, 'Con un 33 % de oxígeno en el aire hubo libélulas de 70 cm de envergadura.'],
  [2.52e8, 'La Gran Mortandad casi borra la vida: los volcanes de Siberia ardieron durante un millón de años.'],
  [2.0e8, 'Todos los continentes estaban unidos en uno solo: Pangea.'],
  [1.5e8, 'El Argentinosaurus pesaba como 15 elefantes. Las aves de hoy son dinosaurios que sobrevivieron.'],
  [6.6e7, 'El asteroide de Chicxulub medía unos 10 km. El impacto liberó más energía que millones de bombas atómicas.'],
  [5.0e7, 'Hace 50 millones de años había palmeras y cocodrilos cerca del Polo Norte.'],
  [6.0e6, 'Compartes con los chimpancés alrededor del 98 % del ADN.'],
  [3.0e5, 'Durante miles de años convivieron varias especies humanas: sapiens, neandertales, denisovanos…'],
  [4.0e4, 'Si no tienes antepasados solo africanos, entre el 1 % y el 2 % de tu ADN es neandertal.'],
  [1.2e4, 'Göbekli Tepe, un templo de piedra en Turquía, es 6.000 años más antiguo que Stonehenge.'],
  [5.0e3, 'Cleopatra vivió más cerca en el tiempo de la llegada a la Luna que de la construcción de la Gran Pirámide.'],
  [2.0e3, 'Roma llegó a tener un millón de habitantes; Europa no vería otra ciudad así hasta Londres en 1800.'],
  [500, 'La imprenta de Gutenberg hizo que en 50 años se imprimieran más libros que en los mil años anteriores.'],
  [200, 'En 1800 éramos unos mil millones de personas. Hoy somos más de ocho mil millones.'],
  [50, 'Un móvil actual tiene millones de veces más potencia de cálculo que el ordenador del Apolo 11.'],
];
export function curiosidadDe(a) {
  let txt = CURIOSIDADES[0][1];
  for (const [e, t] of CURIOSIDADES) if (a <= e) txt = t;
  return txt;
}

// ---------- formato ----------
const AHORA = new Date().getFullYear();
const n = (x, d = 0) => x.toLocaleString('es-ES', { maximumFractionDigits: d, useGrouping: 'always' });

export function formatearTiempo(a) {
  if (a < 0.5) return { hace: 'Hoy', anio: `año ${AHORA}` };
  if (a >= 1e7) return { hace: `hace ${n(Math.round(a / 1e6))} millones de años`, anio: null };
  if (a >= 1e6) return { hace: `hace ${n(a / 1e6, 1)} millones de años`, anio: null };
  if (a >= 1e4) return { hace: `hace ${n(Math.round(a / 100) * 100)} años`, anio: null };
  const y = AHORA - Math.round(a);
  return { hace: `hace ${n(Math.round(a))} años`, anio: y > 0 ? `año ${y} d. C.` : `año ${1 - y} a. C.` };
}

// cantidades grandes en palabras: 8.100.000.000 → «8.100 millones»
export function cantidad(x) {
  if (x < 1) return '—';
  if (x >= 1e9) return `${n(x / 1e9, x < 1e10 ? 1 : 0)} mil millones`;
  if (x >= 1e6) return `${n(x / 1e6, x < 1e7 ? 1 : 0)} millones`;
  if (x >= 1e4) return `${n(Math.round(x / 1e3))} mil`;
  return n(Math.round(x));
}

export function anosDesdeInicio(a) {
  const d = EDAD_TIERRA - a;
  if (d < 1e6) return `${n(Math.round(d / 1e3))} mil años`;
  return cantidad(d) + ' de años';
}
