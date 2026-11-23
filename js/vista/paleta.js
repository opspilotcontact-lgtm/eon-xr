// Orbes de poder (RM/RV): dos filas delante del valle, clima arriba y regalos abajo.
// Se pellizcan para elegir; los regalos sin a quién ir se apagan.
import * as THREE from 'three';
import { PODERES } from '../poderes.js';
import { REGALOS } from '../valle/regalos.js';
import { crearCartel } from './rotulo.js';

const FILAS = [{ lista: PODERES, y: 0.62 }, { lista: REGALOS, y: 0.3 }];
const Z = 3.55, SEP = 0.5;

export function crearPaleta() {
  const grupo = new THREE.Group(); grupo.name = 'paleta'; grupo.visible = false;
  const orbes = [];
  for (const { lista, y } of FILAS) {
    const ids = Object.keys(lista);
    ids.forEach((id, i) => {
      const P = lista[id];
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 12),
        new THREE.MeshStandardMaterial({ color: P.color, emissive: P.color, emissiveIntensity: 0.35, roughness: 0.4, transparent: true }));
      m.position.set((i - (ids.length - 1) / 2) * SEP, y, Z);
      m.userData = { poder: id, y0: y };
      const et = crearCartel(256, 64, 0.36);
      et.dibujar(id, ctx => {
        ctx.fillStyle = 'rgba(8,10,16,0.7)'; ctx.beginPath(); ctx.roundRect(0, 0, 256, 64, 14); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '600 28px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(P.nombre, 128, 34);
      });
      et.sprite.position.set(0, -0.17, 0);
      m.add(et.sprite);
      grupo.add(m);
      orbes.push(m);
    });
  }
  let apagados = new Set();
  return {
    grupo, orbes,
    seleccionar(id) {
      for (const o of orbes) {
        const si = o.userData.poder === id;
        o.scale.setScalar(si ? 1.35 : 1);
        o.material.emissiveIntensity = si ? 1.2 : 0.35;
      }
    },
    // regalos que ahora no tienen a quién ir: medio transparentes
    disponibles(set) {
      apagados = new Set(Object.keys(REGALOS).filter(id => !set.has(id)));
      for (const o of orbes) o.material.opacity = apagados.has(o.userData.poder) ? 0.3 : 1;
    },
    porFrame(t) {
      orbes.forEach((o, i) => { o.position.y = o.userData.y0 + Math.sin(t * 1.3 + i) * 0.02; o.rotation.y = t * 0.5; });
    },
  };
}
