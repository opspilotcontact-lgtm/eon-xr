// Simulación del planeta (pura, sin three.js): geografía con semilla, clima y vida por celdas,
// pintado de las texturas que enseña la vista y la divergencia entre dos mundos.
//
// Convenio de coordenadas = THREE.SphereGeometry: u ∈ [0,1] longitud, v ∈ [0,1] de sur (0) a norte (1);
// dirección (x, y, z) = (-cos φ · sin θ, cos θ, sin φ · sin θ) con φ = 2πu y θ = π(1 − v).
// La fila 0 de cada textura es v ≈ 0 (sur), como espera una DataTexture sin flipY.
import { crearRuido } from './ruido.js';
import { PODERES } from '../poderes.js';

export const GW = 64, GH = 32, N = GW * GH;   // rejilla de simulación
export const TW = 512, TH = 256;              // texturas
export const DP_SUB = 0.0004;                 // un paso de simulación, en unidades de p
export const RELIEVE = 0.045;                 // relieve máximo en radios (lo usa también el shader)
const TAU = 0.015;                            // vida (en p) de una intervención: se desvanece con el tiempo

const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const c01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const mix = (a, b, t) => a + (b - a) * t;

export function dirDe(u, v) {
  const phi = u * Math.PI * 2, theta = Math.PI * (1 - v), s = Math.sin(theta);
  return [-Math.cos(phi) * s, Math.cos(theta), Math.sin(phi) * s];
}

// ---------- geografía (compartida por el mundo del jugador y la sombra canónica) ----------
export function crearGeo(semilla) {
  const R = crearRuido(semilla);
  const o = Array.from({ length: 12 }, () => R.rnd() * 200 - 100);
  const n = TW * TH;
  const crudo = new Float32Array(n), grieta = new Float32Array(n), nubes = new Uint8Array(n * 4);
  for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
    const [x, y, z] = dirDe((i + 0.5) / TW, (j + 0.5) / TH), k = j * TW + i;
    const cont = R.fbm(x * 1.3 + o[0], y * 1.3 + o[1], z * 1.3 + o[2], 4);
    const det = R.fbm(x * 4 + o[3], y * 4 + o[4], z * 4 + o[5], 5);
    const cr = 1 - Math.abs(R.fbm(x * 2.6 + o[6], y * 2.6 + o[7], z * 2.6 + o[8], 4));
    crudo[k] = cont + det * 0.28 + Math.max(0, cont) * cr * cr * 0.5;
    grieta[k] = Math.pow(1 - Math.abs(R.fbm(x * 9 + o[9], y * 9 + o[10], z * 9 + o[11], 3)), 6);
    // nubes estiradas en longitud, como bandas de viento
    const nb = R.fbm(x * 3 + o[2], y * 6 + o[5], z * 3 + o[8], 5);
    const al = Math.round(suave(0.12, 0.42, nb) * 255);
    nubes[k * 4] = nubes[k * 4 + 1] = nubes[k * 4 + 2] = al; nubes[k * 4 + 3] = 255;
  }
  // normalizar: ~34 % de tierra con mar = 0; tierra 0…1 (llanuras abundantes), fondo 0…−1
  const orden = Float32Array.from(crudo).sort();
  const q = orden[Math.floor(n * 0.66)], hi = orden[Math.floor(n * 0.997)], lo = orden[Math.floor(n * 0.003)];
  const elev = new Float32Array(n), elevBytes = new Uint8Array(n * 4);
  for (let k = 0; k < n; k++) {
    const v = crudo[k];
    const e = v >= q ? Math.min(1, Math.pow((v - q) / (hi - q), 1.4)) : -Math.min(1, Math.pow((q - v) / (q - lo), 0.6));
    elev[k] = e;
    elevBytes[k * 4] = elevBytes[k * 4 + 1] = elevBytes[k * 4 + 2] = Math.round((e + 1) * 127.5); elevBytes[k * 4 + 3] = 255;
  }

  // rejilla de simulación: elevación media por bloque, latitud, dirección y cinturón desértico (~27°)
  const bx = TW / GW, by = TH / GH;
  const elevG = new Float32Array(N), lat = new Float32Array(N), cosLat = new Float32Array(N), sin2 = new Float32Array(N);
  const dirG = new Float32Array(N * 3), hadley = new Float32Array(N);
  for (let J = 0; J < GH; J++) for (let I = 0; I < GW; I++) {
    const c = J * GW + I;
    let s = 0;
    for (let y = 0; y < by; y++) for (let x = 0; x < bx; x++) s += elev[(J * by + y) * TW + I * bx + x];
    elevG[c] = s / (bx * by);
    const v = (J + 0.5) / GH, la = Math.PI * (v - 0.5);
    lat[c] = la; cosLat[c] = Math.cos(la); sin2[c] = Math.sin(la) ** 2;
    const d = dirDe((I + 0.5) / GW, v); dirG[c * 3] = d[0]; dirG[c * 3 + 1] = d[1]; dirG[c * 3 + 2] = d[2];
    hadley[c] = Math.exp(-((((Math.abs(la) * 180 / Math.PI) - 27) / 9) ** 2));
  }

  // interpolación bilineal precalculada de la rejilla a cada píxel de textura
  const i00 = new Uint16Array(n), i10 = new Uint16Array(n), i01 = new Uint16Array(n), i11 = new Uint16Array(n);
  const fx = new Float32Array(n), fy = new Float32Array(n);
  for (let j = 0; j < TH; j++) {
    const gy = (j + 0.5) * GH / TH - 0.5, y0 = Math.floor(gy), ty = gy - y0;
    const ya = Math.min(GH - 1, Math.max(0, y0)), yb = Math.min(GH - 1, Math.max(0, y0 + 1));
    for (let i = 0; i < TW; i++) {
      const gx = (i + 0.5) * GW / TW - 0.5, x0 = Math.floor(gx), tx = gx - x0;
      const xa = (x0 + GW) % GW, xb = (x0 + 1) % GW, k = j * TW + i;
      i00[k] = ya * GW + xa; i10[k] = ya * GW + xb; i01[k] = yb * GW + xa; i11[k] = yb * GW + xb; fx[k] = tx; fy[k] = ty;
    }
  }
  return { elev, elevBytes, grieta, nubes, elevG, lat, cosLat, sin2, dirG, hadley, i00, i10, i01, i11, fx, fy };
}

// ---------- un mundo: estado por celda y reglas ----------
export function crearMundo(geo) {
  const { elevG, cosLat, sin2, dirG, hadley } = geo;
  const T = new Float32Array(N).fill(150), H = new Float32Array(N), V = new Float32Array(N), I = new Float32Array(N);
  // memoria del planeta: suelo fértil (tarda en formarse) y glaciar (masa de hielo que se enfría a sí misma)
  const S = new Float32Array(N), G = new Float32Array(N), nS = new Float32Array(N), nG = new Float32Array(N);
  const PT = new Float32Array(N), PH = new Float32Array(N);
  const nT = new Float32Array(N), nH = new Float32Array(N), nV = new Float32Array(N), nI = new Float32Array(N);
  let Pmar = 0, mar = -1.5, hieloTierra = 0, colonizado = false;
  const interv = [];

  function paso(fz, f) {
    const dec = Math.exp(-DP_SUB * f / TAU);
    if (fz.magma > 0.02) {
      // océano de magma: nada de agua, hielo ni vida
      mar = -1.5; T.fill(150); H.fill(0); V.fill(0); I.fill(0); S.fill(0); G.fill(0);
      decaer(dec); return;
    }
    const sinAgua = fz.mar < -1;
    // el hielo sobre tierra baja el mar; menos hielo que hoy (~39 % de la tierra) lo sube
    mar = fz.mar - 0.2 * (hieloTierra - 0.39) + Pmar;
    // las plantas salen del agua una sola vez: después la vida solo se expande desde sus vecinas,
    // así una zona arrasada tarda millones de años en recuperarse (la huella de tus cambios)
    if (fz.tierra && !colonizado) { colonizado = true; V.fill(0.03); }
    const kT = 0.3 * f, kH = 0.35 * f, kI = 0.15 * f, dif = 0.25 * f;
    for (let c = 0; c < N; c++) {
      const x = c % GW, J = (c / GW) | 0;
      const l = J * GW + (x + GW - 1) % GW, r = J * GW + (x + 1) % GW;
      const up = J < GH - 1 ? c + GW : c, dn = J > 0 ? c - GW : c;
      const avT = (T[l] + T[r] + T[up] + T[dn]) * 0.25;
      const avH = (H[l] + H[r] + H[up] + H[dn]) * 0.25;
      const avV = (V[l] + V[r] + V[up] + V[dn]) * 0.25;
      const e = elevG[c], oceano = e < mar;

      // temperatura: latitud + clima global + altitud − hielo (el hielo se enfría a sí mismo) + intervenciones
      let tt = 30.5 - 44 * sin2[c] + fz.dT - 7 * I[c] + PT[c];
      tt = oceano ? tt * 0.85 + 2 : tt - 10 * Math.max(0, e) - 12 * G[c];
      const t0 = T[c] + (avT - T[c]) * dif;
      nT[c] = t0 + (tt - t0) * kT;

      // humedad: el mar es la fuente; tierra adentro llega por difusión; el bosque genera su propia lluvia
      let ht;
      if (sinAgua) ht = 0;
      else if (oceano) ht = I[c] > 0.6 ? 0.35 : 1;
      else {
        ht = 0.93 * avH * (1 - 0.45 * hadley[c]) + 0.22 * V[c];
        if (T[c] > 30) ht -= (T[c] - 30) * 0.02;
        if (T[c] < -10) ht *= 0.6;
      }
      ht = c01(ht + PH[c]);
      nH[c] = H[c] + (ht - H[c]) * kH;

      // hielo: aparece bajo −1 °C y es total bajo −9 °C
      nI[c] = I[c] + (suave(1, 9, -T[c]) - I[c]) * kI;

      // vida en tierra (potencial también en celdas de costa): crece donde hay agua y temperatura amable
      if (!fz.tierra) nV[c] = 0;
      else {
        const campana = c01(1 - ((T[c] - 22) / 24) ** 2);
        const apto = c01((H[c] - 0.18) / 0.42) * campana * (1 - I[c]);
        const dv = 0.4 * apto * (0.3 + 0.7 * S[c]) * (V[c] + 0.0004 + 0.12 * avV) * (1 - V[c]) - 0.1 * (1 - apto) * V[c];
        nV[c] = c01(V[c] + dv * f);
      }
      // suelo: lo crean las plantas muy despacio; el hielo y la erosión sin plantas lo destruyen
      const ds = 0.035 * V[c] * (1 - S[c]) - 0.06 * I[c] * S[c] - 0.006 * (1 - V[c]) * S[c];
      nS[c] = c01(S[c] + ds * f);
      // glaciar: crece sobre tierra helada y solo se funde cuando deja de estarlo
      const dg = oceano ? -0.05 * G[c] : 0.025 * suave(0.75, 0.95, I[c]) * (1 - G[c]) - 0.012 * (1 - I[c]) * G[c];
      nG[c] = c01(G[c] + dg * f);
    }
    T.set(nT); H.set(nH); I.set(nI); V.set(nV); S.set(nS); G.set(nG);
    let w = 0, hi = 0;
    for (let c = 0; c < N; c++) if (elevG[c] >= mar) { w += cosLat[c]; hi += cosLat[c] * I[c]; }
    hieloTierra = w ? hi / w : 0;
    decaer(dec);
  }

  function decaer(dec) {
    for (let c = 0; c < N; c++) { PT[c] *= dec; PH[c] *= dec; }
    Pmar *= dec;
    for (const x of interv) x.f *= dec;
    for (let i = interv.length - 1; i >= 0; i--) if (interv[i].f < 0.04) interv.splice(i, 1);
  }

  function intervenir(poder, u, v) {
    const P = PODERES[poder]; if (!P) return;
    const [x, y, z] = dirDe(u, v), ca = Math.cos(P.radio * Math.PI / 180);
    for (let c = 0; c < N; c++) {
      const d = x * dirG[c * 3] + y * dirG[c * 3 + 1] + z * dirG[c * 3 + 2];
      if (d <= ca) continue;
      let w = (d - ca) / (1 - ca); w = w * w * (3 - 2 * w);
      PT[c] = Math.max(-45, Math.min(45, PT[c] + P.T * w));
      PH[c] = Math.max(-1, Math.min(1, PH[c] + P.H * w));
    }
    Pmar = Math.min(0.3, Pmar + P.mar);
    interv.push({ poder, u, v, f: 1 });
  }

  function extinguir(k) { for (let c = 0; c < N; c++) V[c] *= 1 - k; }

  function stats() {
    let wA = 0, wT = 0, vT = 0, hi = 0, hu = 0, te = 0;
    for (let c = 0; c < N; c++) {
      const w = cosLat[c];
      wA += w; hi += w * suave(0.3, 0.7, I[c]); hu += w * H[c]; te += w * T[c];
      if (elevG[c] >= mar) { wT += w; vT += w * V[c]; }
    }
    return { vidaT: wT ? vT / wT : 0, hielo: hi / wA, humedad: hu / wA, temp: te / wA, tierra: wT / wA, mar };
  }

  // color (RGB sRGB) + rugosidad en alfa
  function pintar(out, fz) {
    const { elev, grieta, i00, i10, i01, i11, fx, fy } = geo;
    const so = 1 - fz.o2, vm = fz.vidaMar, magma = fz.magma;
    for (let k = 0, q = 0; k < TW * TH; k++, q += 4) {
      const a = i00[k], b = i10[k], c = i01[k], d = i11[k], tx = fx[k], ty = fy[k];
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const t = T[a] * w00 + T[b] * w10 + T[c] * w01 + T[d] * w11;
      const h = H[a] * w00 + H[b] * w10 + H[c] * w01 + H[d] * w11;
      const v = V[a] * w00 + V[b] * w10 + V[c] * w01 + V[d] * w11;
      const ic = I[a] * w00 + I[b] * w10 + I[c] * w01 + I[d] * w11;
      const e = elev[k];
      let r, g, bl, ro;
      if (e < mar) {
        // agua: azul moderno o verdoso (hierro disuelto) antes de la Gran Oxidación
        const prof = Math.pow(c01((mar - e) * 2.2), 0.6);
        r = mix(mix(52, 92, so), mix(8, 22, so), prof);
        g = mix(mix(140, 118, so), mix(34, 44, so), prof);
        bl = mix(mix(170, 78, so), mix(78, 36, so), prof);
        const vt = 0.22 * vm * (1 - prof);
        r = mix(r, 28, vt); g = mix(g, 120, vt); bl = mix(bl, 110, vt);
        const hm = suave(0.35, 0.75, ic);
        r = mix(r, 222, hm); g = mix(g, 233, hm); bl = mix(bl, 242, hm);
        ro = mix(0.38, 0.6, hm);
      } else {
        // suelo desnudo: roca ↔ arena según calor y sequedad
        const arena = c01(1 - h * 1.5) * suave(4, 26, t);
        r = mix(98, 204, arena); g = mix(88, 170, arena); bl = mix(78, 112, arena);
        // vegetación: sabana seca → pradera → bosque; tundra parda con frío
        const hum = suave(0.4, 0.85, h), sab = suave(0.2, 0.45, h), fr = suave(6, -4, t) * 0.6;
        let vr = mix(158, mix(84, 32, hum), sab), vg = mix(146, mix(132, 80, hum), sab), vb = mix(82, mix(52, 38, hum), sab);
        vr = mix(vr, 120, fr); vg = mix(vg, 118, fr); vb = mix(vb, 92, fr);
        const cv = suave(0.04, 0.65, v);
        r = mix(r, vr, cv); g = mix(g, vg, cv); bl = mix(bl, vb, cv);
        const mo = suave(0.45, 0.9, e) * 0.65;
        r = mix(r, 122, mo); g = mix(g, 114, mo); bl = mix(bl, 106, mo);
        const nv = Math.max(suave(0.3, 0.7, ic), suave(0.7, 0.95, e) * suave(10, 0, t));
        r = mix(r, 240, nv); g = mix(g, 244, nv); bl = mix(bl, 248, nv);
        ro = 0.93;
      }
      if (magma > 0) {
        const cr = grieta[k], cal = c01(cr * 1.6 + 0.08);
        r = mix(r, mix(38, 255, cal), magma);
        g = mix(g, mix(16, mix(70, 190, cr), cal), magma);
        bl = mix(bl, mix(10, mix(10, 60, cr), cal), magma);
        ro = mix(ro, 0.7, magma);
      }
      out[q] = r; out[q + 1] = g; out[q + 2] = bl; out[q + 3] = ro * 255;
    }
  }

  // mapa de normales (espacio tangente) del relieve visible: max(elevación, mar)
  function pintarNormales(out) {
    const { elev } = geo, S = RELIEVE * 3;   // relieve exagerado en la luz para que se lea a escala de mesa
    for (let j = 0; j < TH; j++) {
      const la = Math.PI * ((j + 0.5) / TH - 0.5);
      const du = Math.max(0.05, Math.cos(la)) * 4 * Math.PI / TW, dv = 2 * Math.PI / TH;
      const jd = Math.max(0, j - 1) * TW, ju = Math.min(TH - 1, j + 1) * TW, jj = j * TW;
      for (let i = 0; i < TW; i++) {
        const il = (i + TW - 1) % TW, ir = (i + 1) % TW;
        const hL = Math.max(elev[jj + il], mar), hR = Math.max(elev[jj + ir], mar);
        const hD = Math.max(elev[jd + i], mar), hU = Math.max(elev[ju + i], mar);
        const nx = -(hR - hL) * S / du, ny = -(hU - hD) * S / dv, l = Math.hypot(nx, ny, 1);
        const q = (jj + i) * 4;
        out[q] = (nx / l * 0.5 + 0.5) * 255; out[q + 1] = (ny / l * 0.5 + 0.5) * 255; out[q + 2] = (1 / l * 0.5 + 0.5) * 255; out[q + 3] = 255;
      }
    }
  }

  return {
    T, H, V, I, interv,
    get mar() { return mar; },
    paso, intervenir, extinguir, stats, pintar, pintarNormales,
  };
}

// distancia entre dos mundos con la misma geografía → 0–100 %
export function divergencia(A, B, geo) {
  const { cosLat, elevG } = geo;
  let w = 0, dv = 0, di = 0, dt = 0;
  for (let c = 0; c < N; c++) {
    const wc = cosLat[c]; w += wc;
    dv += wc * (elevG[c] >= B.mar ? 1 : 0.3) * Math.abs(A.V[c] - B.V[c]);
    di += wc * Math.abs(A.I[c] - B.I[c]);
    dt += wc * Math.min(1, Math.abs(A.T[c] - B.T[c]) / 30);
  }
  const d = (dv * 1.2 + di + dt * 0.5) / w + Math.abs(A.mar - B.mar) * 2;
  return Math.round(100 * (1 - Math.exp(-d * 5)));
}
