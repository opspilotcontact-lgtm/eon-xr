// Contenido del panel «Datos del mundo» a partir del estado del worker. Lo usan el HTML de
// escritorio y el panel flotante de RM/RV, así los dos dicen exactamente lo mismo.
import { eraDe, formatearTiempo, anosDesdeInicio, cantidad, curiosidadDe } from './sim/canon.js';
import { PODERES } from './poderes.js';

const pct = x => `${Math.round(x * 100)} %`;
const grados = (x, magma) => magma > 0.5 ? 'más de 1.000 °C' : `${x.toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} °C`;
// 1 unidad de elevación ≈ la montaña más alta (~8.000 m)
function nivelMar(m, magma) {
  if (magma > 0.02 || m < -1) return 'sin océanos';
  const metros = Math.round(m * 8000 / 10) * 10;
  return metros === 0 ? 'como hoy' : `${metros > 0 ? '+' : '−'}${Math.abs(metros).toLocaleString('es-ES')} m`;
}

export function contenidoDatos(e) {
  const t = formatearTiempo(e.a), r = e.cifras.real, y = e.cifras.tuyo;
  const total = Object.values(e.intervenciones || {}).reduce((s, n) => s + n, 0);
  const desglose = Object.entries(e.intervenciones || {}).map(([k, n]) => `${n} ${PODERES[k].nombre.toLowerCase()}`).join(', ');
  return {
    era: eraDe(e.a), hace: t.hace, anio: t.anio, desde: anosDesdeInicio(e.a), divergencia: e.divergencia,
    secciones: [
      {
        titulo: 'Planeta', filas: [
          ['Temperatura media', grados(e.tuyo.temp, e.magma), grados(e.real.temp, e.magma)],
          ['Superficie helada', pct(e.tuyo.hielo), pct(e.real.hielo)],
          ['Nivel del mar', nivelMar(e.tuyo.mar, e.magma), nivelMar(e.real.mar, e.magma)],
          ['Oxígeno en el aire', `${Math.round(r.oxigeno)} %`, null],
          ['Un día dura', `${r.dia.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h`, null],
        ],
      },
      {
        titulo: 'Vida', filas: [
          ['Forma dominante', r.vida, null],
          ['Especies (estimación)', cantidad(y.especies), cantidad(r.especies)],
          ['Tierra con vegetación', pct(e.tuyo.vidaT), pct(e.real.vidaT)],
        ],
      },
      {
        titulo: 'Sociedad', filas: [
          ['Población humana', cantidad(y.poblacion), cantidad(r.poblacion)],
          ['Tus intervenciones', total ? `${total} (${desglose})` : 'ninguna', null],
        ],
      },
    ],
    curiosidad: curiosidadDe(e.a),
  };
}
