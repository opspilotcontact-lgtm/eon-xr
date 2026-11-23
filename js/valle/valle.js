// El Valle entero: terreno + simulación + actores + efectos + carteles de los pueblos.
// app.js le pasa cada estado del worker (clima global) y él decide qué se ve en la parcela.
import * as THREE from 'three';
import { crearTerreno, SITIOS } from './terreno.js';
import { crearSimValle, NIVEL_TXT } from './sim.js';
import { crearActores } from './actores.js';
import { crearEfectos } from './efectos.js';
import { crearObras } from './obras.js';
import { crearTrafico } from './trafico.js';
import { crearVida } from './vida.js';
import { REGALOS } from './regalos.js';
import { crearCartel, fondoCartel } from '../vista/rotulo.js';

export function crearValle(semilla) {
  const terreno = crearTerreno(semilla);
  const grupo = terreno.grupo;
  const sim = crearSimValle(semilla, SITIOS);
  const actores = crearActores(terreno, grupo, semilla);
  const efectos = crearEfectos(grupo);
  const obras = crearObras(terreno, grupo, actores);
  const trafico = crearTrafico(terreno, grupo, actores, obras, semilla);
  const vida = crearVida(terreno, grupo, actores, semilla);

  // luz propia del valle: gira con el sol (las sombras del día pasan sobre la mesa)
  const luz = new THREE.DirectionalLight('#fff2dc', 2.6), objetivo = new THREE.Object3D();
  luz.target = objetivo; grupo.add(luz, objetivo);

  // carteles de los pueblos
  const carteles = {};
  for (const id of Object.keys(SITIOS)) {
    const c = crearCartel(512, 150, 1.0);
    c.sprite.visible = false; grupo.add(c.sprite);
    carteles[id] = c;
  }
  function dibujarCartel(pu, guerra) {
    const c = carteles[pu.id], alto = pu.nivel >= 7 ? 1.35 : pu.nivel >= 6 ? 0.95 : pu.nivel >= 4 ? 0.45 : 0.3;
    c.sprite.position.set(pu.x, alto, pu.z); c.sprite.visible = true;
    const linea2 = `${pu.ruinas > 0.3 ? 'en ruinas' : NIVEL_TXT[pu.nivel]} · ${pu.n} ${pu.n === 1 ? 'persona' : 'personas'}`;
    const enGuerra = guerra && (guerra.ataca === pu.id || guerra.defiende === pu.id);
    c.dibujar([pu.nombre, linea2, enGuerra].join('|'), ctx => {
      fondoCartel(ctx, 512, 150);
      ctx.fillStyle = pu.color; ctx.fillRect(28, 34, 12, 82);
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '700 46px system-ui, sans-serif';
      ctx.fillText(pu.nombre.length > 20 ? pu.nombre.slice(0, 19) + '…' : pu.nombre, 58, 70);
      ctx.fillStyle = enGuerra ? '#ff8a6a' : '#b8bfcc'; ctx.font = '500 32px system-ui, sans-serif';
      ctx.fillText(enGuerra ? `en guerra · ${pu.n} personas` : linea2, 58, 116);
    });
  }

  let V = null, aPrev = Infinity;
  const vistas = new Set();

  function actualizar(m) {
    V = sim.calcular(m.p, { a: m.a, mar: m.mar, magma: m.magma, tuyo: m.tuyo, real: m.real });
    // el asteroide de la historia real
    if (aPrev > 6.6e7 && m.a <= 6.6e7 && aPrev - m.a < 3e7) efectos.impacto(-3.7, Math.max(V.mar, terreno.altura(-3.7, -0.9)), -0.9);
    aPrev = m.a;
    for (const ex of V.explosiones) {
      if (vistas.has(ex.id)) continue;
      vistas.add(ex.id);
      efectos.explosion(ex.x, terreno.altura(ex.x, ex.z), ex.z, { escala: 1.25 });
      actores.golpe(ex.x, ex.z);
    }
    actores.sincronizar(V);
    obras.sincronizar(V);
    trafico.sincronizar(V);
    vida.sincronizar(V);
    terreno.actualizar({
      lava: V.lava, mar: V.mar, plantas: V.plantas, hierba: V.hierba, helecho: V.helecho, nieve: V.nieve, seco: V.seco, tapetes: V.tapetes,
      ciudades: actores.urbano.filter(u => u.suelo), heridas: V.heridas,
    });
    for (const id of Object.keys(carteles)) {
      const pu = V.pueblos.find(x => x.id === id);
      if (pu) dibujarCartel(pu, V.guerra); else carteles[id].sprite.visible = false;
    }
    return V;
  }

  // punto en coordenadas del mundo → local del valle
  function aplicar(tipo, puntoMundo) {
    if (!V) return { ok: false, motivo: 'Esperá a que arranque el valle' };
    const l = grupo.worldToLocal(puntoMundo.clone());
    return sim.aplicar(tipo, l.x, l.z, V.p, V.a);
  }

  // qué regalos tienen a quién ir ahora mismo
  function disponibles() {
    const s = new Set();
    if (!V) return s;
    const fauna = V.fauna.herb + V.fauna.peq + V.fauna.depr > 0, pueblos = V.pueblos.length > 0;
    for (const [id, R] of Object.entries(REGALOS)) {
      if ((R.objetivo === 'fauna' && fauna) || (R.objetivo === 'pueblo' && pueblos) || (R.objetivo === 'ambos' && (fauna || pueblos))) s.add(id);
    }
    return s;
  }

  return {
    grupo, golpe: terreno.golpe, terreno, actores, efectos, sim, obras, trafico, vida,
    get estado() { return V; },
    actualizar, aplicar, disponibles,
    // camaraMundo: posición de la cámara en el mundo (para desvanecer los carteles de cerca)
    porFrame(dt, angSol, camaraMundo) {
      if (camaraMundo) {
        const c = grupo.worldToLocal(camaraMundo.clone());
        for (const k of Object.values(carteles)) { const d = c.distanceTo(k.sprite.position); k.sprite.material.opacity = Math.min(1, Math.max(0, (d - 0.9) / 0.9)); }
      }
      luz.position.set(Math.cos(angSol) * 4.5, 6, -Math.sin(angSol) * 4.5);
      actores.porFrame(dt);
      trafico.porFrame(dt);
      vida.porFrame(dt);
      efectos.paso(dt);
    },
    destruir() {
      grupo.removeFromParent();
      grupo.traverse(o => { o.geometry?.dispose?.(); });
    },
  };
}
