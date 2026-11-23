// El planeta en three.js: superficie con relieve por shader (max(elevación, mar), para que el mar
// suba y baje sin rehacer la malla), nubes, atmósfera con borde iluminado y marcas de intervención.
// Las texturas las pinta el worker; aquí solo se suben.
import * as THREE from 'three';
import { TW, TH, RELIEVE, dirDe } from '../sim/mundo.js';
import { PODERES } from '../poderes.js';

export const INCLINACION = 23.4 * Math.PI / 180;
const Z = new THREE.Vector3(0, 0, 1);

function texDatos(srgb, mip) {
  const t = new THREE.DataTexture(new Uint8Array(TW * TH * 4), TW, TH, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.generateMipmaps = mip; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}

export function crearPlaneta() {
  const grupo = new THREE.Group(); grupo.name = 'planeta';
  grupo.rotation.z = INCLINACION;

  const texColor = texDatos(true, true), texNormal = texDatos(false, true), texElev = texDatos(false, false), texNubes = texDatos(false, true);
  const uMar = { value: -1.5 };
  const mat = new THREE.MeshStandardMaterial({
    map: texColor, normalMap: texNormal, displacementMap: texElev, displacementScale: RELIEVE,
    roughness: 1, metalness: 0, emissive: new THREE.Color('#ff8a4a'), emissiveMap: texColor, emissiveIntensity: 0,
  });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uMar = uMar;
    sh.vertexShader = 'uniform float uMar;\n' + sh.vertexShader.replace('#include <displacementmap_vertex>', `
#ifdef USE_DISPLACEMENTMAP
  float eDesp = texture2D( displacementMap, vDisplacementMapUv ).x * 2.0 - 1.0;
  transformed += normalize( objectNormal ) * max( eDesp, uMar ) * displacementScale;
#endif`);
    // rugosidad en el alfa de la textura de color: mar brillante, tierra mate
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>',
      'float roughnessFactor = roughness * texture2D( map, vMapUv ).a;');
  };
  mat.customProgramCacheKey = () => 'eon-planeta';
  const malla = new THREE.Mesh(new THREE.SphereGeometry(1, 256, 128), mat);
  malla.name = 'superficie';
  grupo.add(malla);

  const matNubes = new THREE.MeshStandardMaterial({ color: '#ffffff', alphaMap: texNubes, transparent: true, depthWrite: false, opacity: 0.5, roughness: 1 });
  const nubes = new THREE.Mesh(new THREE.SphereGeometry(1.035, 96, 48), matNubes);
  nubes.renderOrder = 2;
  grupo.add(nubes);

  const matAtm = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#5aa0ff') }, uSol: { value: new THREE.Vector3(1, 0, 0) }, uFuerza: { value: 1 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vP;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform vec3 uSol; uniform float uFuerza;
      varying vec3 vN; varying vec3 vP;
      void main() {
        vec3 n = normalize(vN), v = normalize(cameraPosition - vP);
        float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        float luz = 0.15 + 0.85 * smoothstep(-0.35, 0.5, dot(n, uSol));
        float k = clamp(rim * luz * uFuerza, 0.0, 1.0);
        gl_FragColor = vec4(uColor * k, k);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const atmos = new THREE.Mesh(new THREE.SphereGeometry(1.09, 64, 32), matAtm);
  atmos.renderOrder = 3;
  grupo.add(atmos);

  // esfera sencilla para apuntar (raycast barato)
  const golpe = new THREE.Mesh(new THREE.SphereGeometry(1.02, 24, 12), new THREE.MeshBasicMaterial({ visible: false }));
  golpe.name = 'golpePlaneta';
  grupo.add(golpe);

  // marcas de intervención: un aro sobre la esfera por cada poder activo
  const marcas = new THREE.Group(); grupo.add(marcas);
  const geoAro = new THREE.RingGeometry(0.9, 1, 64);
  function aplicarMarcas(lista) {
    while (marcas.children.length < lista.length) {
      const m = new THREE.Mesh(geoAro, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      m.renderOrder = 4; marcas.add(m);
    }
    marcas.children.forEach((m, i) => {
      const x = lista[i]; m.visible = !!x; if (!x) return;
      const P = PODERES[x.poder], al = P.radio * Math.PI / 180, R = 1.075;
      const d = new THREE.Vector3(...dirDe(x.u, x.v));
      m.position.copy(d).multiplyScalar(Math.cos(al) * R);
      m.quaternion.setFromUnitVectors(Z, d);
      m.scale.setScalar(Math.sin(al) * R);
      m.material.color.set(P.color);
      m.userData.base = 0.25 + 0.65 * x.f;
    });
  }

  const azul = new THREE.Color('#5aa0ff'), naranja = new THREE.Color('#e8964a'), rojo = new THREE.Color('#ff5a2a');
  let humedad = 0.5, magma = 1;
  return {
    grupo, malla, golpe,
    aplicarGeo({ elev, nubes: nb }) {
      texElev.image.data = new Uint8Array(elev); texElev.needsUpdate = true;
      texNubes.image.data = new Uint8Array(nb); texNubes.needsUpdate = true;
    },
    aplicarEstado(e) {
      if (e.color) { texColor.image.data = new Uint8Array(e.color); texColor.needsUpdate = true; }
      if (e.normal) { texNormal.image.data = new Uint8Array(e.normal); texNormal.needsUpdate = true; }
      uMar.value = e.mar;
      magma = e.magma; humedad = e.tuyo.humedad;
      mat.emissiveIntensity = magma * 1.4;
      matNubes.opacity = (0.08 + 0.42 * humedad) * (1 - magma * 0.5);
      matNubes.color.set(magma > 0.1 ? '#4a4038' : '#ffffff');
      matAtm.uniforms.uColor.value.copy(naranja).lerp(azul, e.o2).lerp(rojo, magma);
      aplicarMarcas(e.interv);
    },
    porFrame(dt, velocidad, solMundo) {
      nubes.rotation.y += dt * (0.01 + 0.025 * Math.min(velocidad, 10));
      const c = grupo.getWorldPosition(new THREE.Vector3());
      matAtm.uniforms.uSol.value.copy(solMundo).sub(c).normalize();
      const t = performance.now() / 1000;
      marcas.children.forEach((m, i) => { if (m.visible) m.material.opacity = m.userData.base * (0.8 + 0.2 * Math.sin(t * 4 + i)); });
    },
    // punto en el mundo → (u, v) de la superficie
    uvDePunto(p) {
      const l = malla.worldToLocal(p.clone()).normalize();
      const th = Math.acos(Math.max(-1, Math.min(1, l.y)));
      let ph = Math.atan2(l.z, -l.x); if (ph < 0) ph += Math.PI * 2;
      return { u: ph / (Math.PI * 2), v: 1 - th / Math.PI };
    },
  };
}
