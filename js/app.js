// Eón · F0: escena, bucle, ratón y cableado con el worker de simulación.
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
camera.position.set(0.8, 1.4, 6.2);

const mundo = new THREE.Group(); mundo.name = 'mundo';
scene.add(mundo);
const planeta = crearPlaneta();
const sol = crearSol();
mundo.add(planeta.grupo, sol.grupo, sol.luz, sol.objetivo);
scene.add(new THREE.HemisphereLight('#9fb4ff', '#1a1410', 0.18));

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
rotulo.sprite.position.set(0, 1.85, 0); rotulo.sprite.visible = false;
const panelDatos = crearCartel(1024, 1280, 2.1);
panelDatos.sprite.position.set(-3.4, 0.35, 0.6); panelDatos.sprite.visible = false;
mundo.add(rotulo.sprite, panelDatos.sprite);

// ---------- estado de la partida ----------
const reloj = crearReloj();
let estado = null, worker = null, enVuelo = false, acumulado = 0, ultimoEnvio = 0, fin = false;
let ultimoSuceso = null, sucesoT = 0, solTocado = false;

const juego = {
  poder: null,
  seleccionar(id) {
    juego.poder = id;
    hud.marcarPoder(id); paleta.seleccionar(id); xr?.marcarPoder(id ? PODERES[id].color : null);
    lienzo.style.cursor = id ? 'crosshair' : '';
  },
  aplicar(puntoMundo) {
    if (!juego.poder || !worker) return;
    const { u, v } = planeta.uvDePunto(puntoMundo);
    worker.postMessage({ tipo: 'intervenir', poder: juego.poder, u, v });
    if (reloj.velocidad < 0.05) aviso(`${PODERES[juego.poder].nombre} lista: su efecto se verá cuando pase el tiempo`);
  },
  alAgarrarSol() { solTocado = true; hud.ayuda(null); },
  avisoXR(txt) { ultimoSuceso = { tipo: 'hito', texto: txt }; sucesoT = performance.now(); },
  alEntrarXR() { controls.enabled = false; },
  alSalirXR() { controls.enabled = true; camera.position.set(0.8, 1.4, 6.2); controls.target.set(0, 0, 0); controls.update(); },
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
  estado = m;
  planeta.aplicarEstado(m);
  hud.actualizar(m);
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
const planoSol = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ALTURA_SOL);
let arrastreSol = false, angRaton = 0, pulsadoEn = null;
function rayoRaton(ev) {
  const r = lienzo.getBoundingClientRect();
  puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(puntero, camera);
  return ray;
}
function anguloRaton(ev) {
  const p = rayoRaton(ev).ray.intersectPlane(planoSol, new THREE.Vector3());
  if (p) angRaton = Math.atan2(-p.z, p.x);
  return angRaton;
}
// en captura: se decide antes que OrbitControls si el gesto es del sol, de un poder o de la cámara
lienzo.addEventListener('pointerdown', ev => {
  if (renderer.xr.isPresenting || ev.button !== 0) return;
  const h = rayoRaton(ev).intersectObjects([sol.golpe, planeta.golpe], false)[0];
  if (h?.object === sol.golpe) {
    arrastreSol = true; controls.enabled = false;
    reloj.agarrar(anguloRaton(ev)); juego.alAgarrarSol();
    try { lienzo.setPointerCapture(ev.pointerId); } catch { /* puntero sintético */ } lienzo.style.cursor = 'grabbing';
  } else if (h?.object === planeta.golpe && juego.poder) {
    controls.enabled = false; pulsadoEn = h.point.clone();
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
  if (pulsadoEn) { juego.aplicar(pulsadoEn); pulsadoEn = null; }
  controls.enabled = !renderer.xr.isPresenting;
});
addEventListener('keydown', ev => {
  if (ev.key === 'Escape') juego.seleccionar(null);
  if (ev.key === ' ') { ev.preventDefault(); reloj.fijar(reloj.velocidad < 0.05 ? 1 : 0); }
});

const controls = new OrbitControls(camera, lienzo);
controls.enableDamping = true; controls.minDistance = 2.2; controls.maxDistance = 14; controls.enablePan = false;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const xr = montarXR({ renderer, scene, camera, mundo, planeta, sol, paleta, carteles: [rotulo.sprite, panelDatos.sprite], estrellas, fondo, reloj, juego });

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
const solMundo = new THREE.Vector3();
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
  paleta.porFrame(t / 1000);
  xr.porFrame(frame, dt);
  if (xr.modo && ahora - cartelT > 250) { cartelT = ahora; dibujarCarteles(); }
  hud.velocidad(reloj.velocidad, reloj.agarrado);
  if (!renderer.xr.isPresenting) controls.update();
  renderer.render(scene, camera);
});

nuevaPartida();
// depuración y pruebas
window.__eon = { get estado() { return estado; }, saltar(dp) { acumulado += dp; }, reloj, juego, planeta, mundo, scene, camera, renderer, get semilla() { return semilla; } };
