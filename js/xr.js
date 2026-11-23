// Realidad mixta y virtual (Quest): sesión, mandos y manos, colocar el planeta sobre la mesa real,
// agarrar el sol (el tiempo), elegir y soltar poderes, y mover/escalar el mundo con una o dos manos.
// La lógica de agarre viene de la maqueta de Cocina XR.
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { aviso } from './hud.js';

const UP = new THREE.Vector3(0, 1, 0);
const yawQ = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
const angXZ = v => Math.atan2(-v.z, v.x);
export const ESCALA_XR = 0.15;          // radio del planeta en metros
const ESC_MIN = 0.05, ESC_MAX = 0.6;
const SOBRE_MESA = 0.32;                // centro del planeta por encima de la mesa (m)
const BUSCAR_MESA = 8;                  // segundos buscando una mesa al entrar en RM

export function montarXR({ renderer, scene, camera, mundo, planeta, sol, paleta, carteles, estrellas, fondo, reloj, juego }) {
  const btnVR = document.getElementById('btnVR'), btnAR = document.getElementById('btnAR');
  function comprobarSoporte() {
    if (!navigator.xr) return;
    navigator.xr.isSessionSupported('immersive-vr').then(v => { btnVR.disabled = !v; }).catch(() => { });
    navigator.xr.isSessionSupported('immersive-ar').then(v => { btnAR.disabled = !v; }).catch(() => { });
  }
  comprobarSoporte();
  navigator.xr?.addEventListener?.('devicechange', comprobarSoporte);
  btnVR.addEventListener('click', () => entrar('vr'));
  btnAR.addEventListener('click', () => entrar('ar'));

  const fovEscritorio = camera.fov;
  let modo = null, sesion = null, sueloY = 0, colocarPendiente = false, buscarMesa = 0, anim = null;
  let agarreSol = null;
  const ray = new THREE.Raycaster(), mtx = new THREE.Matrix4();

  // ---------- mandos y manos ----------
  const fabrica = new XRControllerModelFactory(), fabricaManos = new XRHandModelFactory();
  const lineaGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const esMano = c => !!c.userData.fuente?.hand;
  const mandos = [0, 1].map(i => {
    const c = renderer.xr.getController(i), g = renderer.xr.getControllerGrip(i), mano = renderer.xr.getHand(i);
    g.add(fabrica.createControllerModel(g));
    mano.add(fabricaManos.createHandModel(mano, 'spheres'));
    const linea = new THREE.Line(lineaGeo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }));
    linea.scale.z = 2; c.add(linea);
    // el poder elegido viaja en la mano
    const portado = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
    portado.position.set(0, 0, -0.05); portado.visible = false; c.add(portado);
    c.userData = { fuente: null, linea, portado, mano };
    c.addEventListener('connected', ev => { c.userData.fuente = ev.data; });
    c.addEventListener('disconnected', () => { alSoltar(c); soltarMundo(c); c.userData.fuente = null; });
    c.addEventListener('selectstart', () => alPulsar(c));
    c.addEventListener('selectend', () => alSoltar(c));
    c.addEventListener('squeezestart', () => agarrarMundo(c));
    c.addEventListener('squeezeend', () => soltarMundo(c));
    scene.add(c, g, mano);
    return c;
  });
  function pulso(c, fuerza = 0.3, ms = 20) {
    try { c.userData.fuente?.gamepad?.hapticActuators?.[0]?.pulse?.(fuerza, ms); } catch { /* sin vibración */ }
  }
  const posDe = c => c.getWorldPosition(new THREE.Vector3());

  function rayoDe(c) {
    mtx.identity().extractRotation(c.matrixWorld);
    ray.ray.origin.setFromMatrixPosition(c.matrixWorld);
    ray.ray.direction.set(0, 0, -1).applyMatrix4(mtx);
    return ray;
  }
  function objetivo(c) {
    // con la mano cerca del sol basta (pellizcarlo «en el aire»)
    if (posDe(c).distanceTo(sol.malla.getWorldPosition(new THREE.Vector3())) < 0.07) return { tipo: 'sol', dist: 0 };
    const candidatos = [sol.golpe, planeta.golpe, ...(paleta.grupo.visible ? paleta.orbes : [])];
    const h = rayoDe(c).intersectObjects(candidatos, false)[0];
    if (!h) return null;
    if (h.object === sol.golpe) return { tipo: 'sol', dist: h.distance };
    if (h.object === planeta.golpe) return { tipo: 'planeta', punto: h.point, dist: h.distance };
    return { tipo: 'orbe', poder: h.object.userData.poder, dist: h.distance };
  }
  // ángulo de la mano alrededor del planeta, en el plano de la órbita del sol
  function anguloDe(c) { const l = mundo.worldToLocal(posDe(c)); return Math.atan2(-l.z, l.x); }

  function alPulsar(c) {
    if (!modo) return;
    const o = objetivo(c);
    if (o?.tipo === 'sol' && !agarreSol) { agarreSol = c; reloj.agarrar(anguloDe(c)); pulso(c, 0.4, 30); juego.alAgarrarSol(); return; }
    if (o?.tipo === 'orbe') { juego.seleccionar(juego.poder === o.poder ? null : o.poder); pulso(c, 0.3, 25); return; }
    if (o?.tipo === 'planeta' && juego.poder) { juego.aplicar(o.punto); pulso(c, 0.7, 60); return; }
    if (esMano(c) || !o) agarrarMundo(c);
  }
  function alSoltar(c) {
    if (agarreSol === c) { agarreSol = null; reloj.soltar(); }
    if (esMano(c)) soltarMundo(c);
  }

  // ---------- agarrar el mundo: una mano mueve y gira, dos manos escalan ----------
  const agarres = new Set();
  let base = null;
  function yawDe(c) {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(c.getWorldQuaternion(new THREE.Quaternion())).setY(0);
    return f.lengthSq() < 0.09 ? null : Math.atan2(-f.x, -f.z);
  }
  function reiniciarAgarre() {
    const cs = [...agarres];
    if (!cs.length) { base = null; return; }
    base = { pos: mundo.position.clone(), q: mundo.quaternion.clone(), s: mundo.scale.x };
    if (cs.length === 1) { base.h = posDe(cs[0]); base.yaw = yawDe(cs[0]); }
    else {
      const a = posDe(cs[0]), b = posDe(cs[1]);
      base.mid = a.clone().add(b).multiplyScalar(0.5);
      base.d = Math.max(0.02, a.distanceTo(b));
      base.ang = angXZ(b.clone().sub(a));
    }
  }
  function agarrarMundo(c) {
    if (!modo) return;
    anim = null; buscarMesa = 0;
    agarres.add(c);
    if (agarres.size > 2) agarres.delete(agarres.values().next().value);
    reiniciarAgarre(); pulso(c, 0.2, 15);
  }
  function soltarMundo(c) { if (agarres.delete(c)) reiniciarAgarre(); }
  function pasoAgarre() {
    const cs = [...agarres];
    if (!base || !cs.length) return;
    if (cs.length === 1) {
      const y = yawDe(cs[0]), dy = base.yaw === null || y === null ? 0 : y - base.yaw, q = yawQ(dy);
      mundo.position.copy(base.pos).sub(base.h).applyQuaternion(q).add(posDe(cs[0]));
      mundo.quaternion.copy(q).multiply(base.q);
      return;
    }
    const a = posDe(cs[0]), b = posDe(cs[1]);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const s = THREE.MathUtils.clamp(base.s * a.distanceTo(b) / base.d, ESC_MIN, ESC_MAX), k = s / base.s;
    const q = yawQ(angXZ(b.clone().sub(a)) - base.ang);
    mundo.position.copy(base.pos).sub(base.mid).multiplyScalar(k).applyQuaternion(q).add(mid);
    mundo.quaternion.copy(q).multiply(base.q);
    mundo.scale.setScalar(s);
  }

  // ---------- colocar ----------
  const cabeza = () => camera.getWorldPosition(new THREE.Vector3());
  function adelante() {
    const f = camera.getWorldDirection(new THREE.Vector3()).setY(0);
    return f.lengthSq() < 1e-6 ? new THREE.Vector3(0, 0, -1) : f.normalize();
  }
  // el lado +z del mundo (orbes y carteles) mira al usuario
  function ponerMundo(T, animado) {
    const u = cabeza().sub(T).setY(0); if (u.lengthSq() < 1e-6) u.set(0, 0, 1); u.normalize();
    const q = yawQ(Math.atan2(u.x, u.z));
    if (animado) anim = { t: 0, p0: mundo.position.clone(), p1: T.clone(), q0: mundo.quaternion.clone(), q1: q, s0: mundo.scale.x, s1: ESCALA_XR };
    else { mundo.position.copy(T); mundo.quaternion.copy(q); mundo.scale.setScalar(ESCALA_XR); }
  }
  function colocarDelante() {
    const h = cabeza(), T = h.clone().addScaledVector(adelante(), 0.8);
    T.y = Math.max(sueloY + 0.7, h.y - 0.3);
    ponerMundo(T, false);
  }
  function pasoAnim(dt) {
    const a = anim; a.t = Math.min(1, a.t + dt / 0.9);
    const k = a.t * a.t * (3 - 2 * a.t);
    mundo.position.lerpVectors(a.p0, a.p1, k);
    mundo.quaternion.slerpQuaternions(a.q0, a.q1, k);
    mundo.scale.setScalar(Math.exp(THREE.MathUtils.lerp(Math.log(a.s0), Math.log(a.s1), k)));
    if (a.t >= 1) anim = null;
  }
  function buscarMesaEn(frame) {
    const det = frame.detectedPlanes; if (!det || !det.size) return;
    const ref = renderer.xr.getReferenceSpace(); if (!ref) return;
    const h = cabeza(), f = adelante();
    let mejor = null;
    for (const p of det) {
      if (p.orientation !== 'horizontal' || !p.polygon?.length) continue;
      let pose = null; try { pose = frame.getPose(p.planeSpace, ref); } catch { pose = null; }
      if (!pose) continue;
      const M = new THREE.Matrix4().fromArray(pose.transform.matrix);
      const c = p.polygon.reduce((s, q) => s.add(new THREE.Vector3(q.x, q.y, q.z).applyMatrix4(M)), new THREE.Vector3()).multiplyScalar(1 / p.polygon.length);
      const alto = c.y - sueloY;
      if (alto < 0.45 || alto > 1.15) continue;
      const v = c.clone().sub(h).setY(0), d = v.length();
      if (d > 2.2) continue;
      const coste = d + (v.dot(f) < 0 ? 2 : 0);
      if (!mejor || coste < mejor.coste) mejor = { c, coste };
    }
    if (mejor) {
      buscarMesa = 0;
      ponerMundo(mejor.c.clone().setY(mejor.c.y + SOBRE_MESA), true);
      juego.avisoXR('Planeta sobre tu mesa');
    }
  }

  // ---------- sesión ----------
  async function entrar(m) {
    if (renderer.xr.isPresenting || sesion || !navigator.xr) return;
    const opciones = m === 'ar'
      ? { requiredFeatures: ['local-floor'], optionalFeatures: ['plane-detection', 'hand-tracking'] }
      : { optionalFeatures: ['local-floor', 'hand-tracking'] };
    let s = null;
    try {
      // requestSession tiene que llamarse sin esperas previas (activación del usuario)
      s = await navigator.xr.requestSession(m === 'ar' ? 'immersive-ar' : 'immersive-vr', opciones);
      sesion = s;
      s.addEventListener('end', terminar);
      let tipo = 'local-floor';
      try { await s.requestReferenceSpace('local-floor'); } catch { tipo = 'local'; }
      sueloY = tipo === 'local' ? -1.6 : 0;
      renderer.xr.setReferenceSpaceType(tipo);
      renderer.xr.setFoveation(1);
      await renderer.xr.setSession(s);
    } catch (err) {
      if (s) { s.removeEventListener('end', terminar); s.end().catch(() => { }); }
      sesion = null; terminar();
      aviso('No se pudo entrar en ' + (m === 'ar' ? 'realidad mixta' : 'realidad virtual') + ': ' + (err?.message || err));
      return;
    }
    modo = m;
    scene.background = m === 'ar' ? null : fondo;
    estrellas.visible = m === 'vr';
    paleta.grupo.visible = true;
    for (const k of carteles) k.visible = true;
    // en RM se ven tus manos reales: sin esferas encima
    for (const c of mandos) c.userData.mano.visible = m === 'vr';
    colocarPendiente = true;
    buscarMesa = m === 'ar' ? BUSCAR_MESA : 0;
    juego.alEntrarXR(m);
  }

  function terminar() {
    sesion = null; modo = null; agarreSol = null; anim = null;
    agarres.clear(); base = null;
    if (reloj.agarrado) reloj.soltar();
    mundo.position.set(0, 0, 0); mundo.quaternion.identity(); mundo.scale.setScalar(1);
    scene.background = fondo; estrellas.visible = true;
    paleta.grupo.visible = false;
    for (const k of carteles) k.visible = false;
    for (const c of mandos) c.userData.portado.visible = false;
    camera.fov = fovEscritorio; camera.zoom = 1; camera.scale.set(1, 1, 1);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    juego.alSalirXR();
  }

  // un error aquí cortaría el bucle de la sesión y congelaría las gafas: se registra una vez y se sigue
  const vistos = new Set();
  function porFrame(frame, dt) {
    if (!modo) return;
    try { paso(frame, dt); } catch (err) {
      const k = String(err?.message || err);
      if (!vistos.has(k)) { vistos.add(k); console.error('XR: error en el fotograma', err); }
    }
  }
  function paso(frame, dt) {
    if (colocarPendiente) { colocarPendiente = false; colocarDelante(); }
    if (buscarMesa > 0 && frame) { buscarMesa -= dt; buscarMesaEn(frame); }
    if (anim) pasoAnim(dt); else pasoAgarre();
    if (agarreSol) reloj.mover(anguloDe(agarreSol), dt);
    mundo.updateMatrixWorld();
    let sobreSol = !!agarreSol;
    for (const c of mandos) {
      if (!c.userData.fuente) continue;
      const o = objetivo(c);
      c.userData.linea.scale.z = o ? Math.max(0.01, o.dist) : 2;
      if (o?.tipo === 'sol') sobreSol = true;
    }
    sol.resaltar(sobreSol);
  }

  return {
    porFrame,
    get modo() { return modo; },
    marcarPoder(color) {
      for (const c of mandos) {
        c.userData.portado.visible = !!color;
        if (color) c.userData.portado.material.color.set(color);
      }
    },
  };
}
