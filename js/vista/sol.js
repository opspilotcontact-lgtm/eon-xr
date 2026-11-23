// El sol: orbita el planeta y es el mando del tiempo. Lleva la luz direccional consigo.
import * as THREE from 'three';

export const ORBITA = 2.6, ALTURA_SOL = 0.25;

function halo() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,230,160,1)'); gr.addColorStop(0.25, 'rgba(255,190,90,0.55)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function crearSol() {
  const grupo = new THREE.Group(); grupo.name = 'sol';
  const malla = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16), new THREE.MeshBasicMaterial({ color: '#ffe2a0', toneMapped: false }));
  const brillo = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  brillo.scale.setScalar(1.5);
  const golpe = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 8), new THREE.MeshBasicMaterial({ visible: false }));
  golpe.name = 'golpeSol';
  grupo.add(malla, brillo, golpe);

  const luz = new THREE.DirectionalLight('#fff4e0', 3.2);
  const objetivo = new THREE.Object3D();
  luz.target = objetivo;

  let resaltado = false;
  return {
    grupo, malla, golpe, luz, objetivo,
    poner(ang) {
      grupo.position.set(Math.cos(ang) * ORBITA, ALTURA_SOL, -Math.sin(ang) * ORBITA);
      luz.position.copy(grupo.position);
    },
    resaltar(si) {
      if (si === resaltado) return; resaltado = si;
      brillo.scale.setScalar(si ? 2.1 : 1.5);
    },
  };
}
