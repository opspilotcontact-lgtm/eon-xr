// Carteles de texto en 3D (sprites sobre un lienzo): el rótulo sobre el planeta y el panel de datos en RM/RV.
import * as THREE from 'three';

export function crearCartel(ancho, alto, metrosAncho) {
  const lienzo = document.createElement('canvas'); lienzo.width = ancho; lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  const tex = new THREE.CanvasTexture(lienzo); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
  sprite.scale.set(metrosAncho, metrosAncho * alto / ancho, 1);
  sprite.renderOrder = 20;
  let clave = '';
  return {
    sprite, ctx, ancho, alto,
    // dibujar(ctx) solo se llama si la clave cambia (evita subir la textura cada fotograma)
    dibujar(k, fn) {
      if (k === clave) return; clave = k;
      ctx.clearRect(0, 0, ancho, alto);
      fn(ctx);
      tex.needsUpdate = true;
    },
  };
}

export function fondoCartel(ctx, w, h) {
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, 28); ctx.fill();
}

// texto con salto de línea automático; devuelve la y siguiente
export function parrafo(ctx, txt, x, y, ancho, alturaLinea) {
  const palabras = txt.split(' ');
  let linea = '';
  for (const p of palabras) {
    const prueba = linea ? linea + ' ' + p : p;
    if (ctx.measureText(prueba).width > ancho && linea) { ctx.fillText(linea, x, y); y += alturaLinea; linea = p; }
    else linea = prueba;
  }
  if (linea) { ctx.fillText(linea, x, y); y += alturaLinea; }
  return y;
}
