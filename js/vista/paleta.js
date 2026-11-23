// Orbes de poder (RM/RV): flotan delante del planeta. Se pellizcan para elegir un poder.
import * as THREE from 'three';
import { PODERES } from '../poderes.js';
import { crearCartel } from './rotulo.js';

export function crearPaleta() {
  const grupo = new THREE.Group(); grupo.name = 'paleta'; grupo.visible = false;
  const ids = Object.keys(PODERES);
  const orbes = ids.map((id, i) => {
    const P = PODERES[id];
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 12),
      new THREE.MeshStandardMaterial({ color: P.color, emissive: P.color, emissiveIntensity: 0.35, roughness: 0.4 }));
    m.position.set((i - (ids.length - 1) / 2) * 0.42, -1.2, 1.3);
    m.userData.poder = id;
    const et = crearCartel(256, 64, 0.36);
    et.dibujar(id, ctx => {
      ctx.fillStyle = 'rgba(8,10,16,0.7)'; ctx.beginPath(); ctx.roundRect(0, 0, 256, 64, 14); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '600 30px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(P.nombre, 128, 34);
    });
    et.sprite.position.set(0, -0.2, 0);
    m.add(et.sprite);
    grupo.add(m);
    return m;
  });
  let elegido = null;
  return {
    grupo, orbes,
    seleccionar(id) {
      elegido = id;
      for (const o of orbes) {
        const si = o.userData.poder === id;
        o.scale.setScalar(si ? 1.35 : 1);
        o.material.emissiveIntensity = si ? 1.2 : 0.35;
      }
    },
    porFrame(t) {
      orbes.forEach((o, i) => { o.position.y = -1.2 + Math.sin(t * 1.3 + i) * 0.025; o.rotation.y = t * 0.5; });
      void elegido;
    },
  };
}
