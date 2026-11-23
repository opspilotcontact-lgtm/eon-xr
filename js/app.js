// Eón: escena, bucle, ratón y cableado con el worker de simulación.
// El Valle (la parcela con personitas) es el protagonista; el globo chico de encima es el clima y el reloj.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { crearPlaneta } from './vista/planeta.js';
import { crearSol, ALTURA_SOL } from './vista/sol.js';
import { crearPaleta } from './vista/paleta.js';
import { crearCartel, fondoCartel, parrafo } from './vista/rotulo.js';
import { crearReloj } from './tiempo.js';
import { crearHud, aviso } from './hud.js';
import { montarXR } from './xr.js';
import { PODERES } from './poderes.js';
import { formatearTiempo } from './sim/canon.js';
import { contenidoDatos } from './datos.js';
import { crearValle } from './valle/valle.js';
import { REGALOS } from './valle/regalos.js';

const params = new URLSearchParams(location.search);
let semilla = Number(params.get('semilla')) || Math.floor(Math.random() * 1e9);

// ---------- escena ----------
const lienzo = document.getElementById('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.xr.enabled = true;

const scene = new THREE.Scene();
const fondo = new THREE.Color('#05060a');
scene.background = fondo;
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.01, 200);
const CAM0 = new THREE.Vector3(0, 4.8, 10.4), MIRA0 = new THREE.Vector3(0, 0.3, 0.4);
camera.position.copy(CAM0);

const mundo = new THREE.Group(); mundo.name = 'mundo';
scene.add(mundo);
const planeta = crearPlaneta();
const sol = crearSol();
// el cielo: globo chico flotando detrás del valle, con el sol que orbita (= el tiempo)
const cielo = new THREE.Group(); cielo.name = 'cielo';
cielo.position.set(0, 2.7, -5.3); cielo.scale.setScalar(0.55);
cielo.add(planeta.grupo, sol.grupo, sol.luz, sol.objetivo);
mundo.add(cielo);
scene.add(new THREE.HemisphereLight('#c8d4ff', '#3a2c20', 0.65));
// zona del valle en el planeta (para que el clima soltado sobre el valle llegue también al globo)
const VALLE_UV = { u: 0.53, v: 0.38 };
let valle = null;

// estrellas (escritorio y RV)
const estrellas = (() => {
  const n = 2500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(t) * s * 60, u * 60, Math.sin(t) * s * 60], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: '#cdd6ff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8 }));
})();
scene.add(estrellas);

const paleta = crearPaleta();
mundo.add(paleta.grupo);

// carteles de RM/RV: rótulo sobre el planeta y panel de datos a un lado (en el escritorio va en HTML)
const rotulo = crearCartel(1024, 300, 2.3);
rotulo.sprite.position.set(0, 4.3, -5.3); rotulo.sprite.visible = false;
const panelDatos = crearCartel(1024, 1280, 2.1);
panelDatos.sprite.position.set(-6.2, 1.5, 0.3); panelDatos.sprite.visible = false;
mundo.add(rotulo.sprite, panelDatos.sprite);

// ---------- estado de la partida ----------
const reloj = crearReloj();
let estado = null, worker = null, enVuelo = false, acumulado = 0, ultimoEnvio = 0, fin = false;
let ultimoSuceso = null, sucesoT = 0, solTocado = false;

const juego = {
  poder: null,
  seleccionar(id) {
    juego.poder = id;
    const P = id && (PODERES[id] || REGALOS[id]);
    hud.marcarPoder(id); paleta.seleccionar(id); xr?.marcarPoder(P ? P.color : null);
    lienzo.style.cursor = id ? 'crosshair' : '';
  },
  // donde: 'planeta' o 'valle'. Los regalos solo van al valle; el clima a los dos
  aplicar(puntoMundo, donde = 'planeta') {
    if (!juego.poder || !worker) return false;
    const id = juego.poder;
    if (REGALOS[id]) {
      if (donde !== 'valle') { juego.avisar('Los regalos se sueltan sobre el valle'); return false; }
      const r = valle.aplicar(id, puntoMundo);
      if (!r.ok) { juego.avisar(r.motivo); return false; }
      if (id === 'bomba') worker.postMessage({ tipo: 'intervenir', poder: 'helada', ...VALLE_UV });
      juego.seleccionar(null);
      if (reloj.velocidad < 0.05) juego.avisar(`${REGALOS[id].nombre}: girá el sol para ver qué pasa`);
      return true;
    }
    const { u, v } = donde === 'valle' ? VALLE_UV : planeta.uvDePunto(puntoMundo);
    if (donde === 'valle') valle.aplicar(id, puntoMundo);
    worker.postMessage({ tipo: 'intervenir', poder: id, u, v });
    if (reloj.velocidad < 0.05) juego.avisar(`${PODERES[id].nombre} lista: su efecto se verá cuando pase el tiempo`);
    return true;
  },
  avisar(txt) { aviso(txt); juego.avisoXR(txt); },
  alAgarrarSol() { solTocado = true; hud.ayuda(null); },
  avisoXR(txt) { ultimoSuceso = { tipo: 'hito', texto: txt }; sucesoT = performance.now(); },
  alEntrarXR() { controls.enabled = false; },
  alSalirXR() { controls.enabled = true; camera.position.copy(CAM0); controls.target.copy(MIRA0); controls.update(); },
};

const hud = crearHud({
  alPoder: id => juego.seleccionar(juego.poder === id ? null : id),
  alVelocidad: v => { reloj.fijar(v); },
  alNueva: () => { semilla = Math.floor(Math.random() * 1e9); nuevaPartida(); },
});

function nuevaPartida() {
  worker?.terminate();
  worker = new Worker(new URL('./sim/worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = alMensaje;
  worker.onerror = e => { console.error('Worker de simulación', e); aviso('Error en la simulación: mirá la consola'); };
  enVuelo = true; acumulado = 0; fin = false; estado = null;
  valle?.destruir();
  valle = crearValle(semilla);
  mundo.add(valle.grupo);
  reloj.fijar(1);
  hud.limpiarSucesos();
  juego.seleccionar(null);
  const url = new URL(location.href); url.searchParams.set('semilla', semilla); history.replaceState(null, '', url);
  worker.postMessage({ tipo: 'iniciar', semilla });
}

function alMensaje({ data: m }) {
  if (m.tipo === 'geo') { planeta.aplicarGeo(m); return; }
  if (m.tipo !== 'estado') return;
  enVuelo = false;
  const V = valle.actualizar(m);
  m.divergencia = Math.max(m.divergencia, V.divergencia);
  m.valle = V;
  // si la humanidad del valle ya tomó otro camino, los hitos humanos del canon se cuentan como «la historia real»
  if (V.divergido) for (const s of m.mensajes) if (s.tipo === 'hito' && (s.a ?? m.a) <= 3e5) s.texto = `En la historia real: ${s.texto.charAt(0).toLowerCase()}${s.texto.slice(1)}`;
  m.mensajes.push(...V.mensajes);
  estado = m;
  planeta.aplicarEstado(m);
  hud.actualizar(m);
  hud.regalos(valle.disponibles());
  paleta.disponibles?.(valle.disponibles());
  for (const s of m.mensajes) {
    const t = formatearTiempo(s.a ?? m.a);
    hud.suceso(s, t.anio ? `${t.hace} · ${t.anio}` : t.hace);
    ultimoSuceso = s; sucesoT = performance.now();
    if (s.tipo === 'hito') reloj.frenar(1.5);
  }
  if (m.fin && !fin) { fin = true; reloj.fijar(0); }
}

// ---------- ratón (escritorio) ----------
const ray = new THREE.Raycaster(), puntero = new THREE.Vector2();
const planoSol = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let arrastreSol = false, angRaton = 0, pulsadoEn = null;
function rayoRaton(ev) {
  const r = lienzo.getBoundingClientRect();
  puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(puntero, camera);
  return ray;
}
// ángulo del ratón alrededor del globo, en el plano de la órbita del sol
function anguloRaton(ev) {
  planoSol.constant = -cielo.localToWorld(new THREE.Vector3(0, ALTURA_SOL, 0)).y;
  const p = rayoRaton(ev).ray.intersectPlane(planoSol, new THREE.Vector3());
  if (p) { cielo.worldToLocal(p); angRaton = Math.atan2(-p.z, p.x); }
  return angRaton;
}
// en captura: se decide antes que OrbitControls si el gesto es del sol, de un poder o de la cámara
lienzo.addEventListener('pointerdown', ev => {
  if (renderer.xr.isPresenting || ev.button !== 0) return;
  const h = rayoRaton(ev).intersectObjects([sol.golpe, planeta.golpe, valle.golpe], false)[0];
  if (h?.object === sol.golpe) {
    arrastreSol = true; controls.enabled = false;
    reloj.agarrar(anguloRaton(ev)); juego.alAgarrarSol();
    try { lienzo.setPointerCapture(ev.pointerId); } catch { /* puntero sintético */ } lienzo.style.cursor = 'grabbing';
  } else if ((h?.object === planeta.golpe || h?.object === valle.golpe) && juego.poder) {
    controls.enabled = false; pulsadoEn = { punto: h.point.clone(), donde: h.object === valle.golpe ? 'valle' : 'planeta' };
  }
}, { capture: true });
lienzo.addEventListener('pointermove', ev => {
  if (renderer.xr.isPresenting) return;
  if (arrastreSol) { anguloRaton(ev); return; }
  if (ev.buttons) return;
  const h = rayoRaton(ev).intersectObjects([sol.golpe], false)[0];
  sol.resaltar(!!h);
  lienzo.style.cursor = h ? 'grab' : juego.poder ? 'crosshair' : '';
});
lienzo.addEventListener('pointerup', () => {
  if (arrastreSol) { arrastreSol = false; reloj.soltar(); lienzo.style.cursor = ''; }
  if (pulsadoEn) { juego.aplicar(pulsadoEn.punto, pulsadoEn.donde); pulsadoEn = null; }
  controls.enabled = !renderer.xr.isPresenting;
});
addEventListener('keydown', ev => {
  if (ev.key === 'Escape') juego.seleccionar(null);
  if (ev.key === ' ') { ev.preventDefault(); reloj.fijar(reloj.velocidad < 0.05 ? 1 : 0); }
});

const controls = new OrbitControls(camera, lienzo);
// zoom hacia el cursor: de la mesa entera a las personitas
controls.enableDamping = true; controls.minDistance = 0.12; controls.maxDistance = 24;
controls.enablePan = true; controls.screenSpacePanning = true; controls.zoomToCursor = true;
controls.target.copy(MIRA0); controls.update();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const xr = montarXR({ renderer, scene, camera, mundo, cielo, golpeValle: () => valle.golpe, planeta, sol, paleta, carteles: [rotulo.sprite, panelDatos.sprite], estrellas, fondo, reloj, juego });

// ---------- carteles de RM/RV ----------
function dibujarCarteles() {
  if (!estado || !xr.modo) return;
  const d = contenidoDatos(estado), v = reloj.velocidad;
  const suceso = ultimoSuceso && performance.now() - sucesoT < 7000 ? ultimoSuceso : null;
  const ayudaTxt = !solTocado ? 'Pellizcá el sol y movelo alrededor del planeta' : null;
  const linea3 = suceso?.texto || ayudaTxt || (v < 0.05 ? 'Tiempo detenido' : `Tiempo ×${v.toFixed(1).replace('.', ',')}`);
  rotulo.dibujar([d.era, d.hace, d.anio, d.divergencia, linea3].join('|'), ctx => {
    fondoCartel(ctx, 1024, 300);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.font = '700 66px system-ui, sans-serif'; ctx.fillText(d.era, 512, 84);
    ctx.font = '500 42px system-ui, sans-serif'; ctx.fillText(d.anio ? `${d.hace} · ${d.anio}` : d.hace, 512, 148);
    ctx.fillStyle = '#9aa1b2'; ctx.font = '500 34px system-ui, sans-serif'; ctx.fillText(`Divergencia ${d.divergencia} %`, 512, 202);
    ctx.fillStyle = suceso?.tipo === 'consecuencia' ? '#ff7a5a' : '#ffc96b'; ctx.font = '600 36px system-ui, sans-serif';
    ctx.fillText(linea3.length > 52 ? linea3.slice(0, 51) + '…' : linea3, 512, 262);
  });
  const clave = JSON.stringify(d.secciones) + d.curiosidad + d.desde;
  panelDatos.dibujar(clave, ctx => {
    fondoCartel(ctx, 1024, 1280);
    let y = 80;
    ctx.textAlign = 'left'; ctx.fillStyle = '#9aa1b2'; ctx.font = '600 30px system-ui, sans-serif';
    ctx.fillText('DATOS DEL MUNDO', 56, y); y += 48;
    ctx.fillStyle = '#fff'; ctx.font = '500 34px system-ui, sans-serif';
    ctx.fillText(`${d.desde} desde que nació la Tierra`, 56, y); y += 30;
    for (const s of d.secciones) {
      y += 50;
      ctx.fillStyle = '#9aa1b2'; ctx.font = '600 26px system-ui, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(s.titulo.toUpperCase(), 56, y);
      ctx.textAlign = 'right'; ctx.fillText('TU MUNDO', 760, y); ctx.fillStyle = '#7fb2ff'; ctx.fillText('REAL', 968, y);
      for (const [k, tuyo, real] of s.filas) {
        y += 50;
        ctx.textAlign = 'left'; ctx.fillStyle = '#c5cad6'; ctx.font = '500 30px system-ui, sans-serif'; ctx.fillText(k, 56, y);
        ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
        const tt = tuyo.length > 30 ? tuyo.slice(0, 29) + '…' : tuyo;
        if (real === null) ctx.fillText(tt, 968, y);
        else { ctx.fillText(tt, 760, y); ctx.fillStyle = '#7fb2ff'; ctx.fillText(real, 968, y); }
      }
    }
    y += 70;
    ctx.fillStyle = 'rgba(255,201,107,0.12)'; ctx.fillRect(40, y - 44, 944, 1280 - y);
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffc96b'; ctx.font = '600 28px system-ui, sans-serif'; ctx.fillText('¿SABÍAS QUE…?', 64, y);
    ctx.fillStyle = '#fff'; ctx.font = '400 32px system-ui, sans-serif';
    parrafo(ctx, d.curiosidad, 64, y + 50, 896, 44);
  });
}

// ---------- bucle ----------
const reloj3 = new THREE.Clock();
const solMundo = new THREE.Vector3(), camMundo = new THREE.Vector3();
let cartelT = 0;
renderer.setAnimationLoop((t, frame) => {
  const dt = Math.min(0.1, reloj3.getDelta());
  if (arrastreSol) reloj.mover(angRaton, dt);
  let dp = reloj.paso(dt);
  if (fin) dp = 0;
  acumulado += dp;
  const ahora = performance.now();
  if (worker && !enVuelo && ahora - ultimoEnvio > 150) {
    worker.postMessage({ tipo: 'avanzar', dp: acumulado });
    acumulado = 0; enVuelo = true; ultimoEnvio = ahora;
  }
  sol.poner(reloj.ang);
  sol.grupo.getWorldPosition(solMundo);
  planeta.porFrame(dt, reloj.velocidad, solMundo);
  valle?.porFrame(dt, reloj.ang, (renderer.xr.isPresenting ? renderer.xr.getCamera() : camera).getWorldPosition(camMundo));
  paleta.porFrame(t / 1000);
  xr.porFrame(frame, dt);
  if (xr.modo && ahora - cartelT > 250) { cartelT = ahora; dibujarCarteles(); }
  hud.velocidad(reloj.velocidad, reloj.agarrado);
  if (!renderer.xr.isPresenting) controls.update();
  renderer.render(scene, camera);
});

nuevaPartida();
// depuración y pruebas
window.__eon = { get valle() { return valle; }, cielo, controls, get estado() { return estado; }, saltar(dp) { acumulado += dp; }, reloj, juego, planeta, mundo, scene, camera, renderer, get semilla() { return semilla; } };
