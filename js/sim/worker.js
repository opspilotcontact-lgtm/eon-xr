// Worker de simulación: el mundo del jugador y su sombra canónica (misma semilla, sin intervenciones)
// avanzan a la vez. Devuelve el estado, las texturas ya pintadas, las cifras del panel y los sucesos.
//
// Mensajes de entrada:  { tipo: 'iniciar', semilla } · { tipo: 'avanzar', dp } · { tipo: 'intervenir', poder, u, v }
// Mensajes de salida:   { tipo: 'geo', elev, nubes } (una vez) · { tipo: 'estado', … } (uno por cada 'avanzar')
import { crearGeo, crearMundo, divergencia, DP_SUB, TW, TH } from './mundo.js';
import { anosAtras, forzamiento, cifrasReales, HITOS, EXTINCIONES } from './canon.js';
import { PODERES } from '../poderes.js';

let geo = null, jugador = null, canon = null;
let p = 0, aPrev = 0, normalMar = null, pendiente = false;
let banderas = {}, cuenta = {};

function iniciar(semilla) {
  geo = crearGeo(semilla);
  jugador = crearMundo(geo); canon = crearMundo(geo);
  p = 0; aPrev = anosAtras(0); normalMar = null; banderas = {}; cuenta = {};
  const fz = forzamiento(aPrev);
  for (let i = 0; i < 4; i++) { jugador.paso(fz, 1); canon.paso(fz, 1); }
  postMessage({ tipo: 'geo', elev: geo.elevBytes.buffer, nubes: geo.nubes.buffer }, [geo.elevBytes.buffer, geo.nubes.buffer]);
  enviar(true, [{ tipo: 'hito', texto: 'Nace la Tierra: un océano de magma' }]);
}

function avanzar(dp) {
  const meta = Math.min(1, p + dp), mensajes = [];
  while (p < meta - 1e-12) {
    const s = Math.min(DP_SUB, meta - p);
    p += s;
    const a = anosAtras(p);
    for (const h of HITOS) if (h.a < aPrev && h.a >= a) mensajes.push({ tipo: 'hito', texto: h.texto, a: h.a });
    for (const x of EXTINCIONES) if (x.a < aPrev && x.a >= a) { jugador.extinguir(x.k); canon.extinguir(x.k); }
    const fz = forzamiento(a);
    jugador.paso(fz, s / DP_SUB); canon.paso(fz, s / DP_SUB);
    aPrev = a;
  }
  if (p >= 1 && !banderas.fin) { banderas.fin = true; mensajes.push({ tipo: 'hito', texto: 'Has llegado a hoy' }); }
  return mensajes;
}

// sucesos que salen de comparar tu mundo con la historia real (se anuncian una vez y se rearman al volver)
function consecuencias(sJ, sC, fz) {
  const out = [];
  const regla = (clave, encender, apagar, texto) => {
    if (!banderas[clave] && encender) { banderas[clave] = true; out.push({ tipo: 'consecuencia', texto }); }
    else if (banderas[clave] && apagar) banderas[clave] = false;
  };
  if (fz.tierra && sC.vidaT > 0.08) {
    const k = sJ.vidaT / sC.vidaT;
    regla('menosVida', k < 0.6, k > 0.85, `La vida en tierra va un ${Math.round((1 - k) * 100)} % por debajo de la historia real`);
    regla('masVida', k > 1.3, k < 1.1, `Hay un ${Math.round((k - 1) * 100)} % más de verde que en la historia real`);
  }
  regla('bolaNieve', sJ.hielo > 0.6 && sC.hielo < 0.4, sJ.hielo < 0.45, 'Has provocado una Tierra bola de nieve');
  regla('frio', sJ.hielo > sC.hielo + 0.1, sJ.hielo < sC.hielo + 0.04, 'Tu planeta se congela más que el real');
  regla('deshielo', sJ.hielo < sC.hielo - 0.07, sJ.hielo > sC.hielo - 0.03, 'Se derrite más hielo que en la historia real');
  regla('marSube', sJ.mar > sC.mar + 0.05, sJ.mar < sC.mar + 0.02, 'El mar sube por encima de la historia real');
  regla('calor', sJ.temp > sC.temp + 3, sJ.temp < sC.temp + 1, 'Tu planeta está más caliente que el real');
  return out;
}

// cifras del panel: las reales del canon y una estimación para tu mundo
// (F0 no simula especies ni personas: se escalan las cifras reales con la vida y el clima de tu mundo)
function cifras(a, sJ, sC) {
  const real = cifrasReales(a);
  const kVida = sC.vidaT > 0.02 ? Math.min(2, sJ.vidaT / sC.vidaT) : 1;
  const kHielo = Math.max(0.05, 1 - Math.max(0, sJ.hielo - sC.hielo) * 2.5);
  const kCalor = Math.max(0.05, 1 - Math.max(0, sJ.temp - sC.temp - 1) * 0.12);
  const kClima = kHielo * kCalor;
  return {
    real,
    tuyo: {
      especies: real.especies * Math.min(1.6, 0.3 + 0.7 * kVida) * kClima,
      poblacion: real.poblacion * kVida * kClima * kClima,
    },
  };
}

function enviar(pintar, mensajes = []) {
  const a = anosAtras(p), fz = forzamiento(a);
  const sJ = jugador.stats(), sC = canon.stats();
  if (pintar) mensajes.push(...consecuencias(sJ, sC, fz));
  const msg = {
    tipo: 'estado', p, a, fin: p >= 1,
    mar: sJ.mar, magma: fz.magma, o2: fz.o2,
    divergencia: divergencia(jugador, canon, geo),
    tuyo: sJ, real: sC, cifras: cifras(a, sJ, sC), intervenciones: cuenta,
    interv: jugador.interv.map(x => ({ poder: x.poder, u: x.u, v: x.v, f: x.f })),
    mensajes,
  };
  const transfer = [];
  if (pintar) {
    const color = new Uint8Array(TW * TH * 4);
    jugador.pintar(color, fz);
    msg.color = color.buffer; transfer.push(color.buffer);
    if (normalMar === null || Math.abs(sJ.mar - normalMar) > 0.004) {
      const nm = new Uint8Array(TW * TH * 4);
      jugador.pintarNormales(nm); normalMar = sJ.mar;
      msg.normal = nm.buffer; transfer.push(nm.buffer);
    }
  }
  postMessage(msg, transfer);
}

onmessage = ({ data: m }) => {
  if (m.tipo === 'iniciar') iniciar(m.semilla);
  else if (!geo) return;
  else if (m.tipo === 'avanzar') {
    const mensajes = m.dp > 0 ? avanzar(m.dp) : [];
    enviar(m.dp > 0 || pendiente, mensajes);
    pendiente = false;
  } else if (m.tipo === 'intervenir' && PODERES[m.poder]) {
    jugador.intervenir(m.poder, m.u, m.v);
    cuenta[m.poder] = (cuenta[m.poder] || 0) + 1;
    pendiente = true;
  }
};
