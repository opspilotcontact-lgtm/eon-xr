// Interfaz HTML de escritorio: reloj, divergencia, sucesos, datos del mundo y mandos.
import { PODERES } from './poderes.js';
import { HITOS, pDe } from './sim/canon.js';
import { contenidoDatos } from './datos.js';

const $ = id => document.getElementById(id);
let avisoT = 0;
export function aviso(txt, ms = 2600) {
  const el = $('aviso'); el.textContent = txt; el.hidden = false;
  clearTimeout(avisoT); avisoT = setTimeout(() => { el.hidden = true; }, ms);
}

export function crearHud({ alPoder, alVelocidad, alNueva }) {
  // poderes
  const cont = $('poderes');
  for (const [id, P] of Object.entries(PODERES)) {
    const b = document.createElement('button'); b.dataset.poder = id;
    b.innerHTML = `<i style="background:${P.color}"></i>${P.nombre}`;
    b.addEventListener('click', () => alPoder(id));
    cont.appendChild(b);
  }
  for (const b of $('velocidades').querySelectorAll('button')) b.addEventListener('click', () => alVelocidad(Number(b.dataset.vel)));
  $('btnNueva').addEventListener('click', alNueva);
  $('btnDatos').addEventListener('click', () => document.body.classList.toggle('ver-datos'));

  // marcas de hitos en la barra del tiempo
  const barra = $('tiempoBarra');
  for (const h of HITOS) { const m = document.createElement('b'); m.style.left = `${pDe(h.a) * 100}%`; m.title = h.texto; barra.appendChild(m); }

  let claveTablas = '';
  return {
    marcarPoder(id) { for (const b of cont.querySelectorAll('button')) b.classList.toggle('on', b.dataset.poder === id); },
    velocidad(v, agarrado) {
      $('vel').textContent = agarrado ? `Sujetando el sol · ×${v.toFixed(1).replace('.', ',')}` : v < 0.05 ? 'Tiempo detenido' : `Tiempo ×${v.toFixed(1).replace('.', ',')}`;
      for (const b of $('velocidades').querySelectorAll('button')) {
        const n = Number(b.dataset.vel);
        b.classList.toggle('on', !agarrado && (n === 0 ? v < 0.05 : Math.abs(v - n) < 0.15));
      }
    },
    actualizar(e) {
      const d = contenidoDatos(e);
      $('era').textContent = d.era;
      $('hace').textContent = d.hace;
      $('anio').textContent = d.anio || '';
      $('desde').textContent = `${d.desde} desde que nació la Tierra`;
      barra.querySelector('i').style.width = `${e.p * 100}%`;
      $('divNum').textContent = `${d.divergencia} %`;
      $('divBarra').querySelector('i').style.width = `${d.divergencia}%`;
      const html = d.secciones.map(s => `<table><tr><th>${s.titulo}</th><th>Tu mundo</th><th>Real</th></tr>${s.filas.map(([k, tuyo, real]) => real === null
        ? `<tr><td>${k}</td><td class="ancho" colspan="2">${tuyo}</td></tr>`
        : `<tr><td>${k}</td><td>${tuyo}</td><td class="real">${real}</td></tr>`).join('')}</table>`).join('');
      if (html !== claveTablas) { claveTablas = html; $('tablas').innerHTML = html; }
      if ($('curTxt').textContent !== d.curiosidad) $('curTxt').textContent = d.curiosidad;
    },
    suceso(m, cuando) {
      const el = document.createElement('div');
      el.className = `suceso caja ${m.tipo}`;
      el.innerHTML = `${m.texto}<small>${cuando}</small>`;
      const lista = $('sucesos'); lista.prepend(el);
      while (lista.children.length > 5) lista.lastChild.remove();
    },
    limpiarSucesos() { $('sucesos').innerHTML = ''; },
    ayuda(txt) { const el = $('ayuda'); if (txt) { el.textContent = txt; el.style.opacity = 1; } else el.style.opacity = 0; },
  };
}
