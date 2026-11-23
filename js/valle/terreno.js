// El Valle: una parcela de ~6 × 6 unidades que resume la Tierra (mar, costa, río, selva, llanura,
// desierto y montaña con nieve). El relieve es fijo por diseño (para que siempre haya de todo) con
// detalle de ruido por semilla. Los colores cambian con la época y el clima; el mar sube y baja.
import * as THREE from 'three';
import { crearRuido } from '../sim/ruido.js';

export const LADO = 6, MITAD = 3, FONDO = -0.46;
const SEG = 128, NV = SEG + 1;

// sitios fijos: A = ciudad del río (junto a la costa), B = pueblo del monte, entre desierto y montaña
export const SITIOS = {
  A: { x: -0.55, z: 0.95, r: 1.05 },
  B: { x: 1.75, z: 0.35, r: 0.6 },
};
const RIO = [[1.55, -1.35], [1.05, -0.75], [0.5, -0.2], [-0.15, 0.12], [-0.85, 0.2], [-1.45, 0.38], [-2.1, 0.5]];

const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mezclar = (a, b, t) => a + (b - a) * t;

function distSegmento(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  const qx = ax + dx * t - px, qz = az + dz * t - pz;
  return Math.sqrt(qx * qx + qz * qz);
}
export function distRio(x, z) {
  let d = Infinity;
  for (let i = 0; i < RIO.length - 1; i++) d = Math.min(d, distSegmento(x, z, RIO[i][0], RIO[i][1], RIO[i + 1][0], RIO[i + 1][1]));
  return d;
}

export function crearTerreno(semilla) {
  const { fbm } = crearRuido((semilla ^ 0x5eed) >>> 0);
  const costa = z => -1.55 + 0.35 * fbm(z * 0.6, 3.1, 0.7, 3);

  // ---------- relieve ----------
  const h = new Float32Array(NV * NV);
  const peso = { bosque: new Float32Array(NV * NV), desierto: new Float32Array(NV * NV), costa: new Float32Array(NV * NV), rio: new Float32Array(NV * NV), ruido: new Float32Array(NV * NV) };
  function relieve(x, z) {
    const n = fbm(x * 0.9, z * 0.9, 1.7, 4);
    let y = 0.09 + n * 0.05;
    // colinas suaves en el norte (bosque)
    y += 0.09 * suave(0.2, -1.6, z) * (0.5 + fbm(x * 1.6, z * 1.6, 8.2, 3));
    // montaña al noreste
    const dx = x - 1.95, dz = z + 1.95, g = Math.exp(-(dx * dx + dz * dz) / (2 * 0.85 * 0.85));
    y += g * (1.0 + 0.35 * fbm(x * 2.2, z * 2.2, 4.4, 4));
    // dunas al sureste
    const wD = suave(0.7, 1.4, x) * suave(0.9, 1.6, z);
    y += wD * (0.025 * Math.sin(x * 9 + z * 4 + n * 3) + 0.02);
    // llanos donde van los pueblos
    for (const s of Object.values(SITIOS)) {
      const d = Math.hypot(x - s.x, z - s.z), w = 1 - suave(s.r * 0.55, s.r * 1.1, d);
      y = mezclar(y, s === SITIOS.A ? 0.1 : 0.15, w * 0.85);
    }
    // mar al oeste
    const d = x - costa(z), tierra = suave(-0.05, 0.5, d);
    y = mezclar(-0.33 + 0.05 * n, y, tierra);
    // río
    const dr = distRio(x, z), wR = 1 - suave(0.04, 0.11, dr);
    y -= wR * 0.065;
    return y;
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
    const x = -MITAD + LADO * i / SEG, z = -MITAD + LADO * j / SEG, k = j * NV + i;
    h[k] = relieve(x, z);
    peso.bosque[k] = suave(0.1, -0.6, z) * suave(-1.5, -0.9, x) * (1 - suave(0.9, 1.5, x)) * (0.55 + 0.9 * Math.max(0, fbm(x * 1.3, z * 1.3, 2.2, 3) + 0.25));
    peso.desierto[k] = suave(0.6, 1.3, x) * suave(0.8, 1.5, z);
    peso.costa[k] = 1 - suave(0.05, 0.4, x - costa(z));
    peso.rio[k] = 1 - suave(0.05, 0.22, distRio(x, z));
    peso.ruido[k] = fbm(x * 3.1, z * 3.1, 9.9, 3);
  }

  function altura(x, z) {
    const fx = Math.min(SEG - 1e-4, Math.max(0, (x + MITAD) / LADO * SEG)), fz = Math.min(SEG - 1e-4, Math.max(0, (z + MITAD) / LADO * SEG));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * NV + i;
    return mezclar(mezclar(h[k], h[k + 1], u), mezclar(h[k + NV], h[k + NV + 1], u), v);
  }
  function pendiente(x, z) {
    const e = 0.04;
    return Math.hypot(altura(x + e, z) - altura(x - e, z), altura(x, z + e) - altura(x, z - e)) / (2 * e);
  }
  const dentro = (x, z, m = 0.08) => Math.abs(x) < MITAD - m && Math.abs(z) < MITAD - m;

  // ---------- mallas ----------
  const grupo = new THREE.Group(); grupo.name = 'valle';
  const geo = new THREE.PlaneGeometry(LADO, LADO, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  // PlaneGeometry rotada: los vértices van por filas de z (de −3 a 3) y columnas de x
  for (let v = 0; v < pos.count; v++) pos.setY(v, altura(pos.getX(v), pos.getZ(v)));
  geo.computeVertexNormals();
  const colores = new Float32Array(pos.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  const matSuelo = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, emissive: new THREE.Color('#ff4a12'), emissiveIntensity: 0 });
  const suelo = new THREE.Mesh(geo, matSuelo); suelo.name = 'suelo';
  grupo.add(suelo);
  // índice del vértice v en la rejilla de alturas (mismo orden que h)
  const idx = new Uint32Array(pos.count);
  for (let v = 0; v < pos.count; v++) {
    const i = Math.round((pos.getX(v) + MITAD) / LADO * SEG), j = Math.round((pos.getZ(v) + MITAD) / LADO * SEG);
    idx[v] = j * NV + i;
  }

  // corte de diorama: paredes de tierra con estratos y base
  {
    const ps = [], cs = [], ix = [];
    const estrato = (y, t) => {
      const b = Math.sin(y * 38 + t * 0.7) * 0.5 + 0.5;
      return [0.24 + 0.08 * b, 0.17 + 0.05 * b, 0.11 + 0.03 * b];
    };
    const lado = (fx, fz) => {
      const base = ps.length / 3;
      for (let s = 0; s <= SEG; s++) {
        const [x, z] = fx(s / SEG * LADO - MITAD), yt = altura(x, z);
        ps.push(x, FONDO, z, x, Math.max(yt, FONDO + 0.01), z);
        cs.push(0.13, 0.09, 0.06, ...estrato(yt, s));
        if (s) { const a = base + (s - 1) * 2; fz ? ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) : ix.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
    };
    lado(t => [t, MITAD], true); lado(t => [t, -MITAD], false);
    lado(t => [MITAD, t], false); lado(t => [-MITAD, t], true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
    g.setIndex(ix); g.computeVertexNormals();
    const paredes = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
    const base = new THREE.Mesh(new THREE.BoxGeometry(LADO + 0.04, 0.05, LADO + 0.04), new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 1 }));
    base.position.y = FONDO - 0.025;
    grupo.add(paredes, base);
  }

  // mar: una caja de agua cuyo techo es el nivel del mar (se ve en el corte como un acuario)
  const matAgua = new THREE.MeshStandardMaterial({ color: '#2d6f9e', transparent: true, opacity: 0.72, roughness: 0.15, metalness: 0.1, depthWrite: false });
  const mar = new THREE.Mesh(new THREE.BoxGeometry(LADO - 0.004, 1, LADO - 0.004).translate(0, 0.5, 0), matAgua);
  mar.renderOrder = 3;
  grupo.add(mar);

  // río: cinta sobre el cauce
  const rio = (() => {
    const pts = [];
    for (let i = 0; i < RIO.length - 1; i++) {
      const [ax, az] = RIO[i], [bx, bz] = RIO[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.03);
      for (let s = 0; s < n; s++) pts.push([mezclar(ax, bx, s / n), mezclar(az, bz, s / n)]);
    }
    pts.push(RIO[RIO.length - 1]);
    const ps = [], ix = [];
    pts.forEach(([x, z], i) => {
      const [nx, nz] = pts[Math.min(i + 1, pts.length - 1)], [px, pz] = pts[Math.max(i - 1, 0)];
      let tx = nx - px, tz = nz - pz; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const w = 0.045 + 0.03 * i / pts.length, y = altura(x, z) + 0.04;
      ps.push(x - tz * w, y, z + tx * w, x + tz * w, y, z - tx * w);
      if (i) { const a = (i - 1) * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3)); g.setIndex(ix); g.computeVertexNormals();
    const m = new THREE.Mesh(g, matAgua); m.renderOrder = 3;
    return m;
  })();
  grupo.add(rio);

  // golpe: caja invisible para soltar poderes y regalos (el punto en x, z es lo que importa)
  const golpe = new THREE.Mesh(new THREE.BoxGeometry(LADO, 0.3, LADO), new THREE.MeshBasicMaterial({ visible: false }));
  golpe.position.y = 0.05; golpe.name = 'golpeValle';
  grupo.add(golpe);

  // ---------- color según la época ----------
  const C = (hex) => new THREE.Color(hex);
  const P = {
    lavaA: C('#1a0e0a'), lavaB: C('#ff5a12'), roca: C('#6b625a'), rocaOsc: C('#4a4440'), arena: C('#cdb27a'), arenaOsc: C('#8a7a5a'),
    tapete: C('#3f7a6a'), musgo: C('#5d7a3a'), helecho: C('#3f6a2a'), selvaVieja: C('#2a4a22'), bosque: C('#2e5a26'), pradera: C('#6f9a3e'),
    seca: C('#b49a5a'), nieve: C('#eef3f7'), desierto: C('#d8b878'), lecho: C('#3a3a3a'), barro: C('#6a5238'), ceniza: C('#2a2622'),
    urbano3: C('#bfa888'), urbano5: C('#6e665c'), urbano6: C('#55575a'), radiacion: C('#3a4a2a'),
  };
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  let clave = '';

  // e = { lava, mar, plantas, hierba, helecho, nieve (cota), seco, ciudades: [{x,z,r,suelo}], heridas: [{x,z,r,k}] }
  function actualizar(e) {
    const k = [e.lava > 0.5, Math.round(e.mar * 60), Math.round(e.plantas * 30), Math.round(e.hierba * 10), e.helecho, Math.round(e.nieve * 40), Math.round(e.seco * 20), e.tapetes,
      e.ciudades.map(c => `${c.x.toFixed(1)}${c.r.toFixed(2)}${c.suelo}`).join(), e.heridas.map(c => c.k.toFixed(1)).join()].join('|');
    // el mar se mueve siempre (es barato); el color solo si cambia algo
    const nivel = Math.max(FONDO + 0.002, e.mar);
    mar.visible = !e.lava && e.mar > FONDO + 0.01;
    mar.scale.y = nivel - FONDO; mar.position.y = FONDO;
    rio.visible = !e.lava && e.mar > FONDO + 0.05 && e.seco < 0.75;
    matAgua.color.set(e.seco > 0.5 ? '#4a7a8a' : '#2d6f9e');
    if (k === clave) return; clave = k;
    matSuelo.emissiveIntensity = e.lava ? 0.45 : 0;
    for (let v = 0; v < pos.count; v++) {
      const i = idx[v], y = h[i], n = peso.ruido[i];
      if (e.lava) {
        const t = Math.max(0, Math.min(1, (n + 0.15) * 3));
        tmp.copy(P.lavaA).lerp(P.lavaB, t * t);
        colores.set([tmp.r, tmp.g, tmp.b], v * 3); continue;
      }
      // base mineral: roca en alto o con pendiente, arena en la costa, desierto al sureste
      const alto = suave(0.35, 0.7, y);
      tmp.copy(P.arenaOsc).lerp(P.roca, 0.5 + n);
      tmp.lerp(P.desierto, peso.desierto[i] * 0.9);
      tmp.lerp(P.arena, peso.costa[i] * suave(e.mar + 0.07, e.mar + 0.01, y));
      tmp.lerp(P.rocaOsc, alto * 0.8);
      if (y < e.mar) tmp.lerp(P.lecho, 0.35);
      // vida en tierra
      if (y > e.mar + 0.008) {
        const humedo = Math.min(1, 0.35 + peso.rio[i] * 0.6 + peso.costa[i] * 0.3 + peso.bosque[i] * 0.4) * (1 - e.seco * 0.8);
        const apto = (1 - peso.desierto[i] * (0.9 - e.seco * 0)) * (1 - alto * 0.85);
        if (e.tapetes && e.plantas < 0.05) tmp.lerp(P.tapete, peso.costa[i] * 0.5 + peso.rio[i] * 0.4);
        const verde = Math.min(1, e.plantas * apto * (0.4 + humedo));
        if (verde > 0.01) {
          // sin hierba (antes de ~30 Ma) el suelo verde es musgo y helechos
          tmp2.copy(P.musgo).lerp(P.pradera, e.hierba).lerp(P.seca, e.seco * 0.8);
          const bosque = Math.min(1, peso.bosque[i] * e.plantas * 1.2 + peso.rio[i] * e.plantas * 0.35);
          tmp2.lerp(e.helecho > 0.5 ? P.selvaVieja : P.bosque, bosque * (1 - e.seco * 0.6));
          tmp.lerp(tmp2, verde);
        }
        // nieve sobre la cota
        const nv = suave(e.nieve, e.nieve + 0.08, y + n * 0.06);
        if (nv > 0) tmp.lerp(P.nieve, nv);
      }
      // suelo de las ciudades
      for (const c of e.ciudades) {
        const d = Math.hypot(pos.getX(v) - c.x, pos.getZ(v) - c.z);
        if (d < c.r && y > e.mar) tmp.lerp(P[c.suelo] || P.urbano3, (1 - suave(c.r * 0.6, c.r, d)) * 0.75);
      }
      // heridas: quemado y radiación
      for (const c of e.heridas) {
        const d = Math.hypot(pos.getX(v) - c.x, pos.getZ(v) - c.z);
        if (d < c.r) tmp.lerp(d < c.r * 0.45 ? P.ceniza : P.radiacion, (1 - suave(c.r * 0.5, c.r, d)) * c.k);
      }
      colores.set([tmp.r, tmp.g, tmp.b], v * 3);
    }
    geo.attributes.color.needsUpdate = true;
  }

  return { grupo, golpe, suelo, altura, pendiente, dentro, actualizar, distRio };
}
