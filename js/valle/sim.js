// Simulación del Valle: la historia real resumida en una parcela (fauna, pueblos, guerras) más las
// consecuencias de los regalos y del clima local. Es una función del avance p y de la lista de
// eventos: así el mismo p con los mismos eventos da siempre lo mismo (semilla → ramas).
// Pura: sin three.js ni DOM.
import { pDe } from '../sim/canon.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lg = a => Math.log10(Math.max(0, a) + 1);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const NIVEL_TXT = ['nómadas', 'cazadores', 'agricultores', 'ciudad antigua', 'medieval', 'industrial', 'moderna', 'futurista'];
export const COLOR_PUEBLO = { A: '#c8463c', B: '#3f7fd0' };

export const nivelCanon = a => a > 6e6 ? -1 : a > 3e5 ? 0 : a > 1.2e4 ? 1 : a > 5000 ? 2 : a > 1550 ? 3 : a > 237 ? 4 : a > 80 ? 5 : 6;

// personas que se ven en el valle (no son cifras reales: es la miniatura)
const GENTE = [[6e6, 4, 0], [3e5, 8, 5], [1.2e4, 20, 10], [5000, 40, 18], [1550, 70, 30], [237, 100, 45], [80, 150, 60], [0, 210, 80]];
function genteCanon(a) {
  if (a >= GENTE[0][0]) return [GENTE[0][1], 0];
  for (let i = 0; i < GENTE.length - 1; i++) {
    const [a0, x0, y0] = GENTE[i], [a1, x1, y1] = GENTE[i + 1];
    if (a >= a1) { const t = (lg(a0) - lg(a)) / (lg(a0) - lg(a1)); return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]; }
  }
  return [GENTE[GENTE.length - 1][1], GENTE[GENTE.length - 1][2]];
}
function nombresCanon(nivel, a) {
  switch (nivel) {
    case 0: return ['Homínidos', null];
    case 1: return ['Clan del río', 'Clan del monte'];
    case 2: return ['Aldea del río', 'Pastores del monte'];
    case 3: return a <= 2779 && a >= 1550 ? ['Romanos', 'Galos'] : ['Ciudad del río', 'Tribus del monte'];
    case 4: return ['Reino del río', 'Señorío del monte'];
    case 5: return ['Nación del río', 'Pueblo del monte'];
    case 6: return ['Metrópolis del río', 'Pueblo del monte'];
    default: return ['Ciudad del futuro', 'Colonia del monte'];
  }
}
function plantasCanon(a) {
  if (a > 4.7e8) return 0;
  let v = 0.35 * suave(4.7e8, 4.0e8, a) + 0.6 * suave(4.0e8, 3.6e8, a);
  v *= 1 - 0.5 * (suave(2.56e8, 2.52e8, a) - suave(2.52e8, 2.4e8, a));   // Gran Mortandad
  v *= 1 - 0.45 * (suave(6.7e7, 6.6e7, a) - suave(6.6e7, 6.2e7, a));     // asteroide
  return v;
}

// guerras de la historia real en el valle (duran DP_GUERRA de partida aunque en años sean cortas)
const DP_GUERRA = 0.007;
const GUERRAS = [
  { a: 9000, ataca: 'B', texto: 'Primera batalla: el clan del monte ataca al del río' },
  { a: 2080, ataca: 'A', texto: 'César conquista la Galia: los romanos atacan a los galos' },
  { a: 690, ataca: 'A', texto: 'Guerra entre el reino y el señorío, como la de los Cien Años' },
  { a: 110, ataca: 'B', texto: 'Primera Guerra Mundial: trincheras en el valle' },
  { a: 84, ataca: 'A', texto: 'Segunda Guerra Mundial' },
].map(g => ({ ...g, p: pDe(g.a) }));
const HITOS_VALLE = [
  { a: 2779, texto: 'Se funda Roma junto al río', soloCanonA: true },
  { a: 1550, texto: 'Cae Roma: llegan los reinos medievales', soloCanonA: true },
].map(h => ({ ...h, p: pDe(h.a) }));

const otro = X => (X === 'A' ? 'B' : 'A');

export function crearSimValle(semilla, sitios) {
  const rnd = mulberry32((semilla ^ 0xa11e) >>> 0);
  const eventos = [];
  const emitidos = new Set();
  let ultimo = null, sigId = 1;

  // ---------- regalos y clima local ----------
  // devuelve { ok, texto } o { ok: false, motivo }
  function aplicar(tipo, x, z, p, a) {
    const V = ultimo;
    if (!V) return { ok: false, motivo: 'Esperá a que arranque el valle' };
    const hayFauna = V.fauna.herb + V.fauna.peq + V.fauna.depr > 0;
    const cercano = () => {
      let mejor = null;
      for (const pu of V.pueblos) { const d = Math.hypot(x - pu.x, z - pu.z); if (!mejor || d < mejor.d) mejor = { id: pu.id, d, r: pu.r }; }
      return mejor;
    };
    const base = { id: sigId++, p0: p, a0: a, x, z };
    if (['sequia', 'diluvio', 'helada', 'sol'].includes(tipo)) {
      eventos.push({ ...base, tipo: 'clima', poder: tipo });
      return { ok: true };
    }
    if (tipo === 'festin') {
      const c = cercano();
      if (c && (c.d < c.r * 1.4 || !hayFauna)) { eventos.push({ ...base, tipo: 'festinPueblo', X: c.id, nX: nombreDe(V, c.id), nY: nombreDe(V, otro(c.id)) }); return { ok: true }; }
      if (!hayFauna) return { ok: false, motivo: 'Todavía no hay animales ni pueblos en el valle' };
      eventos.push({ ...base, tipo: 'festinFauna', dinos: V.fauna.herb > 0 });
      return { ok: true };
    }
    if (tipo === 'depredador') {
      if (!hayFauna) return { ok: false, motivo: 'Todavía no hay animales que cazar' };
      const homo = a < 6e6 && a > 3e5 && !V.extinto ? (rnd() < 0.5 ? 'extinto' : 'retraso') : null;
      eventos.push({ ...base, tipo: 'depredador', dinos: V.fauna.herb > 0, homo });
      return { ok: true };
    }
    const c = cercano();
    if (!c) return { ok: false, motivo: 'Todavía no hay ningún pueblo al que dárselo' };
    if (tipo === 'plaga') { eventos.push({ ...base, tipo: 'plaga', X: c.id, nX: nombreDe(V, c.id) }); return { ok: true }; }
    if (tipo === 'bomba') {
      const X = c.id, Y = otro(X), rival = V.pueblos.some(pu => pu.id === Y);
      const rama = !rival ? 'torpes' : rnd() < 0.5 ? 'imperio' : 'colapso';
      const extintos = rama === 'torpes' && rnd() < 0.5;
      eventos.push({ ...base, tipo: 'bomba', X, Y, rama, extintos, nX: nombreDe(V, X), nY: rival ? nombreDe(V, Y) : null, nivel0: V.pueblos.find(pu => pu.id === X).nivel });
      return { ok: true, rama };
    }
    return { ok: false, motivo: 'Regalo desconocido' };
  }
  const nombreDe = (V, id) => V.pueblos.find(pu => pu.id === id)?.nombre || (id === 'A' ? 'los del río' : 'los del monte');

  // ---------- estado en p ----------
  // g = { a, mar, magma, tuyo: { temp, hielo, vidaT }, real: { … } }
  function calcular(p, g) {
    const a = g.a, nivC = nivelCanon(a), mensajes = [], explosiones = [];
    const M = {
      herb: 1, depr: 1, peq: 1, plantas: 1, gigantes: 1, n: { A: 1, B: 1 }, shift: { A: 0, B: 0 }, ruinas: { A: 0, B: 0 },
      heridas: [], guerra: null, divergido: false, extinto: false, retraso: 0, fijo: {}, seco: 0, humedo: 0, frio: 0, calor: 0, div: 0,
    };
    const msg = (e, dtMin, texto, tipo = 'consecuencia') => {
      const k = `${e.id}:${dtMin}`;
      if (p - e.p0 >= dtMin && !emitidos.has(k)) { emitidos.add(k); mensajes.push({ tipo, texto, a }); }
    };
    for (const e of eventos) {
      const dt = p - e.p0;
      if (dt < 0) continue;
      const S = id => sitios[id];
      switch (e.tipo) {
        case 'clima': {
          const k = Math.exp(-dt / 0.015);
          if (e.poder === 'sequia') { M.seco += 0.85 * k; msg(e, 0, 'Sequía en el valle: el río se seca y la hierba amarillea'); }
          if (e.poder === 'sol') { M.seco += 0.45 * k; M.calor += 0.7 * k; msg(e, 0, 'Sol abrasador: el desierto avanza y la nieve se retira'); }
          if (e.poder === 'diluvio') { M.humedo += k; msg(e, 0, 'Diluvio: el mar sube y anega la costa'); }
          if (e.poder === 'helada') { M.frio += k; msg(e, 0, 'Helada: la nieve baja hasta el valle'); }
          M.div += 3 * suave(0, 0.01, dt);
          break;
        }
        case 'festinFauna': {
          const boom = 1 + 2.2 * suave(0, 0.005, dt), crash = 1 - 0.75 * suave(0.008, 0.013, dt) * (1 - suave(0.02, 0.045, dt));
          if (e.dinos) { M.herb *= boom * crash; M.gigantes = Math.max(M.gigantes, 1 + 0.6 * suave(0.003, 0.015, dt)); }
          else M.peq *= boom * crash;
          M.plantas *= 1 - 0.65 * suave(0.006, 0.011, dt) * (1 - suave(0.02, 0.05, dt));
          const quien = e.dinos ? 'dinosaurios' : 'animales';
          msg(e, 0, `Los ${quien} tienen comida de sobra`);
          msg(e, 0.005, e.dinos ? 'La manada se multiplica y crece: dinosaurios más grandes que los reales' : 'Las manadas se multiplican');
          msg(e, 0.01, 'Se comieron el bosque entero: hambruna en el valle');
          msg(e, 0.03, e.dinos ? 'El bosque vuelve; quedan menos dinosaurios, pero más grandes' : 'El bosque vuelve y las manadas se equilibran');
          M.div += 10 * suave(0, 0.01, dt);
          break;
        }
        case 'depredador': {
          M.depr *= 1 + 2 * suave(0, 0.004, dt);
          if (e.dinos) M.herb *= 1 - 0.6 * suave(0.003, 0.012, dt); else M.peq *= 1 - 0.5 * suave(0.003, 0.012, dt);
          msg(e, 0, 'Llegan más cazadores al valle');
          msg(e, 0.006, 'Los herbívoros escasean');
          if (e.homo) {
            msg(e, 0.004, 'Los depredadores cazan a los homínidos');
            if (e.homo === 'extinto') { if (dt > 0.008) M.extinto = true; msg(e, 0.008, 'Los humanos nunca llegan a existir: el valle es de los animales'); }
            else { M.retraso = Math.max(M.retraso, suave(0.004, 0.008, dt)); msg(e, 0.008, 'Sobreviven pocos: la humanidad irá con retraso'); }
            M.div += (e.homo === 'extinto' ? 70 : 20) * suave(0.004, 0.01, dt);
          }
          M.div += 12 * suave(0, 0.01, dt);
          break;
        }
        case 'festinPueblo': {
          const X = e.X, Y = otro(X);
          M.n[X] *= 1 + 1.0 * suave(0, 0.006, dt);
          msg(e, 0, `Cosechas enormes: ${e.nX} se multiplican`);
          if (dt > 0.007 && dt < 0.014) { M.guerra = { ataca: X, defiende: Y }; msg(e, 0.007, `Sobra gente y falta tierra: ${e.nX} atacan a ${e.nY}`); }
          M.div += 8 * suave(0, 0.01, dt);
          break;
        }
        case 'plaga': {
          M.n[e.X] *= 1 - 0.7 * suave(0, 0.003, dt) * (1 - suave(0.01, 0.04, dt));
          msg(e, 0, `Una plaga se extiende entre ${e.nX}`);
          msg(e, 0.015, `${e.nX} se recuperan de la plaga`);
          M.div += 6 * suave(0, 0.01, dt);
          break;
        }
        case 'bomba': {
          const { X, Y } = e;
          M.divergido = true;
          if (e.rama === 'torpes') {
            explosiones.push({ id: `${e.id}a`, x: S(X).x, z: S(X).z, p0: e.p0 });
            M.ruinas[X] = Math.max(M.ruinas[X], 1 - suave(0.01, 0.05, dt));
            M.heridas.push({ x: S(X).x, z: S(X).z, r: 1, k: 1 - suave(0.03, 0.12, dt) });
            msg(e, 0, `${e.nX} no entienden lo que es: la golpean con piedras y estalla`);
            if (e.extintos) { if (dt > 0.001) M.extinto = true; msg(e, 0.003, 'No queda nadie: los humanos desaparecen del valle'); M.div += 70 * suave(0, 0.01, dt); }
            else { M.n[X] *= 0.15 + 0.85 * suave(0.005, 0.04, dt); M.retraso = Math.max(M.retraso, 1 - suave(0.01, 0.06, dt)); msg(e, 0.004, 'Sobreviven unos pocos lejos de la explosión'); M.div += 25 * suave(0, 0.01, dt); }
            M.frio += 0.6 * suave(0, 0.002, dt) * (1 - suave(0.005, 0.03, dt));
            break;
          }
          explosiones.push({ id: `${e.id}a`, x: S(Y).x, z: S(Y).z, p0: e.p0 });
          M.ruinas[Y] = Math.max(M.ruinas[Y], 1 - suave(0.02, 0.09, dt));
          M.n[Y] *= 0.04 + 0.6 * suave(0.01, 0.08, dt);
          M.heridas.push({ x: S(Y).x, z: S(Y).z, r: 0.95, k: 1 - suave(0.03, 0.12, dt) });
          msg(e, 0, `${e.nX} reciben la bomba atómica y la lanzan sobre ${e.nY}`);
          if (e.rama === 'imperio') {
            // dos eras de adelanto al principio; después, siempre una por delante de la historia real
            M.shift[X] += Math.max(0, Math.min(7, Math.max(nivC + 1, e.nivel0 + 2)) - nivC) * suave(0.002, 0.012, dt);
            M.n[X] *= 1 + 0.6 * suave(0.002, 0.02, dt);
            M.fijo[X] = e.nX; M.fijo[Y] = `${e.nY} conquistados`;
            msg(e, 0.003, `Nadie puede resistir a ${e.nX}: dominan el valle entero`);
            msg(e, 0.012, `${e.nX} dan un salto de siglos: industria y máquinas antes de tiempo`);
            msg(e, 0.035, `Un mundo sin Edad Media: ${e.nX} nunca caen`);
            M.div += 65 * suave(0, 0.015, dt);
          } else {
            const t2 = 0.004;
            if (dt >= t2) {
              explosiones.push({ id: `${e.id}b`, x: S(X).x, z: S(X).z, p0: e.p0 + t2 });
              M.ruinas[X] = Math.max(M.ruinas[X], 1 - suave(0.03, 0.09, dt));
              M.heridas.push({ x: S(X).x, z: S(X).z, r: 1.05, k: 1 - suave(0.04, 0.12, dt) });
              const rec = suave(0.006, 0.09, dt);
              for (const id of ['A', 'B']) { M.n[id] *= 0.08 + 0.92 * rec; M.shift[id] += (1 - nivC) * (1 - rec); }
              M.frio += 0.7 * suave(t2, t2 + 0.002, dt) * (1 - suave(0.01, 0.035, dt));
            }
            msg(e, t2, `${e.nX} no saben controlarla: otra bomba estalla en su propia ciudad`);
            msg(e, 0.008, 'Invierno nuclear: el valle vuelve a la edad de piedra');
            msg(e, 0.09, 'La civilización renace de las ruinas');
            M.div += 60 * suave(0, 0.015, dt);
          }
          break;
        }
      }
    }

    // ---------- clima ----------
    const t = g.tuyo, r = g.real, lava = g.magma > 0.02;
    const kVida = r.vidaT > 0.03 ? clamp(t.vidaT / r.vidaT, 0, 1.4) : 1;
    const seco = clamp(M.seco - M.humedo * 0.5, 0, 1);
    const frio = clamp(M.frio, 0, 1), calor = clamp(M.calor, 0, 1);
    const nieve = lava ? 9 : clamp(0.66 + (t.temp - 14) * 0.035 - frio * 0.75 + calor * 0.35, -0.5, 1.4);
    const plantas = clamp(plantasCanon(a) * kVida * M.plantas * (1 - 0.7 * seco) * (1 - 0.6 * frio), 0, 1.2);
    const mar = lava ? -9 : clamp(g.mar * 2.2, -0.6, 0.3) + 0.12 * clamp(M.humedo, 0, 1.5);
    const kComida = plantasCanon(a) > 0.05 ? clamp(plantas / plantasCanon(a), 0.2, 1.3) : 1;

    // ---------- fauna ----------
    const dinos = suave(2.3e8, 2.05e8, a) * (a > 6.6e7 ? 1 : 0);
    const fauna = {
      herb: Math.round(12 * dinos * M.herb * kComida),
      depr: Math.round((4 * dinos + (a < 6.6e7 && a > 1.2e4 ? 3 : 0)) * M.depr),
      peq: Math.round(((a < 3.3e8 && a > 2.3e8) ? 8 : (a < 6.5e7 && a > 1.2e4) ? 14 : a <= 1.2e4 ? 7 : 0) * M.peq * kComida * (M.extinto ? 1.6 : 1)),
      tipoPeq: a > 2.3e8 ? 'reptil' : 'mamifero',
      gigantes: M.gigantes,
    };
    if (lava || plantasCanon(a) < 0.05) { fauna.herb = 0; fauna.depr = 0; fauna.peq = 0; }

    // ---------- pueblos ----------
    const pueblos = [];
    if (!M.extinto && nivC >= 0) {
      const [gA, gB] = genteCanon(a);
      const kClima = (1 - 0.5 * seco) * (1 - 0.45 * frio) * (nieve < 0.1 ? 0.4 : 1);
      for (const [id, g0] of [['A', gA], ['B', gB]]) {
        if (id === 'B' && nivC < 1) continue;
        const nivel = clamp(Math.round(nivC + M.shift[id] - M.retraso), 0, 7);
        const n = Math.round(g0 * M.n[id] * kClima * (M.retraso ? 1 - 0.5 * M.retraso : 1));
        if (n < 1 && M.ruinas[id] < 0.05) continue;
        const nombre = M.fijo[id] || nombresCanon(nivel, a)[id === 'A' ? 0 : 1];
        pueblos.push({ id, nombre, n, nivel, color: COLOR_PUEBLO[id], x: sitios[id].x, z: sitios[id].z, r: sitios[id].r, ruinas: M.ruinas[id] });
      }
    }
    const hay = id => pueblos.some(pu => pu.id === id && pu.n > 2);

    // guerras de la historia real (si los dos pueblos siguen ahí)
    let guerra = M.guerra;
    for (const gw of GUERRAS) {
      if (Math.abs(p - gw.p) < DP_GUERRA / 2 && !guerra && !M.divergido) {
        guerra = { ataca: gw.ataca, defiende: otro(gw.ataca) };
        const k = `g:${gw.a}`;
        if (!emitidos.has(k) && hay('A') && hay('B')) { emitidos.add(k); mensajes.push({ tipo: 'hito', texto: gw.texto, a }); }
      }
    }
    if (guerra && !(hay(guerra.ataca) && hay(guerra.defiende))) guerra = null;
    for (const h of HITOS_VALLE) {
      const k = `h:${h.a}`;
      if (p >= h.p && p - h.p < 0.004 && !emitidos.has(k) && !M.divergido && hay('A')) { emitidos.add(k); mensajes.push({ tipo: 'hito', texto: h.texto, a }); }
    }

    ultimo = {
      p, a, lava, mar, plantas, seco, frio, nieve,
      hierba: suave(4e7, 2e7, a), helecho: a > 1.3e8 ? 1 : 0, tapetes: a < 3.8e9 && a > 4.7e8,
      fauna, pueblos, guerra, extinto: M.extinto, heridas: M.heridas, explosiones,
      divergencia: clamp(Math.round(M.div), 0, 100), mensajes, divergido: M.divergido || M.extinto,
    };
    return ultimo;
  }

  return { aplicar, calcular, get eventos() { return eventos; }, get ultimo() { return ultimo; } };
}
