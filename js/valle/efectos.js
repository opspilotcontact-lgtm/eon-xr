// Efectos grandes del valle: la seta atómica y el asteroide. Se ven enteros desde la mesa
// (la seta sube más que la montaña) y de cerca (la onda barre a las personitas).
// Una sola PointLight fija que se reutiliza: añadir o quitar luces recompila los shaders (tirón en la Quest).
import * as THREE from 'three';

const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function crearEfectos(padre) {
  const grupo = new THREE.Group(); grupo.name = 'efectos';
  padre.add(grupo);
  const luz = new THREE.PointLight('#ffb070', 0, 7, 1.6);
  grupo.add(luz);
  const activos = [];
  const geoBola = new THREE.SphereGeometry(1, 24, 16), geoAnillo = new THREE.TorusGeometry(1, 0.42, 10, 28), geoTallo = new THREE.CylinderGeometry(0.7, 1, 1, 16, 1, true).translate(0, 0.5, 0);
  const geoOnda = new THREE.RingGeometry(0.92, 1, 64).rotateX(-Math.PI / 2), geoPolvo = new THREE.TorusGeometry(1, 0.35, 8, 32).rotateX(Math.PI / 2);

  function explosion(x, y, z, { escala = 1, seta = true, color = '#ff7a2a' } = {}) {
    const g = new THREE.Group(); g.position.set(x, y, z); grupo.add(g);
    const fuego = new THREE.Color(color), humo = new THREE.Color('#5a5048');
    const flash = new THREE.Mesh(geoBola, new THREE.MeshBasicMaterial({ color: '#fff6d8', transparent: true, depthWrite: false, toneMapped: false }));
    const mBola = new THREE.MeshStandardMaterial({ color: fuego, emissive: fuego, emissiveIntensity: 2.5, transparent: true, roughness: 1 });
    const bola = new THREE.Mesh(geoBola, mBola);
    const anillo = new THREE.Mesh(geoAnillo, mBola); anillo.rotation.x = Math.PI / 2;
    const tallo = new THREE.Mesh(geoTallo, new THREE.MeshStandardMaterial({ color: '#b8784a', emissive: fuego, emissiveIntensity: 0.9, transparent: true, side: THREE.DoubleSide, roughness: 1 }));
    const onda = new THREE.Mesh(geoOnda, new THREE.MeshBasicMaterial({ color: '#fff0d0', transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    const polvo = new THREE.Mesh(geoPolvo, new THREE.MeshStandardMaterial({ color: '#8a7a68', transparent: true, depthWrite: false, roughness: 1 }));
    onda.position.y = 0.02; polvo.position.y = 0.04;
    g.add(flash, bola, onda, polvo);
    if (seta) g.add(anillo, tallo);
    activos.push({ g, t: 0, escala, seta, flash, bola, anillo, tallo, onda, polvo, mBola, fuego, humo, dur: 11 });
  }

  // asteroide: cae en diagonal desde el cielo y revienta en el mar
  function impacto(x, y, z) {
    const roca = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 1), new THREE.MeshStandardMaterial({ color: '#3a3028', emissive: '#ff8a3a', emissiveIntensity: 1.5 }));
    const estela = new THREE.Mesh(new THREE.ConeGeometry(0.08, 1.4, 10, 1, true).translate(0, -0.7, 0).rotateX(Math.PI),
      new THREE.MeshBasicMaterial({ color: '#ffd28a', transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }));
    const desde = new THREE.Vector3(x + 3, y + 4.5, z - 1.5), hasta = new THREE.Vector3(x, y, z);
    const g = new THREE.Group(); g.add(roca, estela); grupo.add(g);
    estela.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), desde.clone().sub(hasta).normalize());
    activos.push({ meteoro: true, g, t: 0, desde, hasta, dur: 1.3 });
  }

  function paso(dt) {
    let brillo = 0;
    for (let i = activos.length - 1; i >= 0; i--) {
      const A = activos[i];
      A.t += dt;
      const t = A.t;
      if (A.meteoro) {
        A.g.position.lerpVectors(A.desde, A.hasta, Math.min(1, t / A.dur) ** 2);
        if (t >= A.dur) { grupo.remove(A.g); activos.splice(i, 1); explosion(A.hasta.x, A.hasta.y, A.hasta.z, { escala: 1.7, seta: false, color: '#ffb05a' }); }
        continue;
      }
      const e = A.escala, fin = 1 - suave(A.dur - 3, A.dur, t);
      // destello
      A.flash.scale.setScalar(0.05 + 0.55 * e * suave(0, 0.35, t));
      A.flash.material.opacity = 1 - suave(0.15, 1.0, t);
      // bola de fuego que sube y se vuelve humo
      const sube = A.seta ? 1.55 * e * (1 - Math.exp(-t / 1.6)) : 0.25 * e * suave(0, 2, t);
      A.bola.position.y = 0.08 + sube;
      A.bola.scale.setScalar((0.1 + 0.3 * suave(0, 1.6, t) + 0.08 * suave(2, 8, t)) * e);
      A.bola.scale.y *= A.seta ? 0.85 : 0.6;
      A.mBola.color.copy(A.fuego).lerp(A.humo, suave(1.2, 5, t));
      A.mBola.emissiveIntensity = 2.5 * (1 - suave(0.8, 4.5, t)) + 0.1;
      A.mBola.opacity = fin;
      if (A.seta) {
        A.anillo.position.y = A.bola.position.y - 0.05 * e;
        const ra = A.bola.scale.x * 0.95;
        A.anillo.scale.set(ra, ra, ra * 0.9);
        A.tallo.scale.set(0.07 * e + 0.05 * e * suave(1, 6, t), A.bola.position.y, 0.07 * e + 0.05 * e * suave(1, 6, t));
        A.tallo.material.opacity = fin * 0.95;
        A.tallo.material.emissiveIntensity = 0.9 * (1 - suave(1, 5, t));
      }
      // onda expansiva por el suelo y anillo de polvo
      A.onda.scale.setScalar(0.05 + 2.3 * e * suave(0, 1.7, t));
      A.onda.material.opacity = 0.9 * (1 - suave(0.3, 1.8, t));
      A.polvo.scale.set(0.1 + 1.0 * e * suave(0, 4, t), 0.1 + 1.0 * e * suave(0, 4, t), 0.25 + 0.4 * suave(0, 4, t));
      A.polvo.material.opacity = 0.45 * fin * suave(0, 0.5, t);
      brillo = Math.max(brillo, 40 * e * (1 - suave(0.05, 3.5, t)) * suave(0, 0.08, t));
      if (brillo > 0) luz.position.copy(A.g.position).y += 0.6;
      if (t >= A.dur) {
        grupo.remove(A.g);
        for (const m of [A.flash.material, A.mBola, A.tallo.material, A.onda.material, A.polvo.material]) m.dispose();
        activos.splice(i, 1);
      }
    }
    luz.intensity = brillo;
  }

  return { explosion, impacto, paso, get activos() { return activos.length; } };
}
