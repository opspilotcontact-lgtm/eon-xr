// Ruido de valor 3D con semilla (determinista): la misma semilla da el mismo planeta.
function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function crearRuido(semilla) {
  const rnd = mulberry32(semilla >>> 0);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  const val = new Float32Array(256);
  for (let i = 0; i < 256; i++) val[i] = rnd() * 2 - 1;

  const h = (i, j, k) => val[perm[(perm[(perm[i & 255] + j) & 255] + k) & 255]];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const mix = (a, b, t) => a + (b - a) * t;

  function ruido(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
    const x00 = mix(h(xi, yi, zi), h(xi + 1, yi, zi), u);
    const x10 = mix(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u);
    const x01 = mix(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u);
    const x11 = mix(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u);
    return mix(mix(x00, x10, v), mix(x01, x11, v), w);
  }

  // suma de octavas normalizada (≈ -0,7…0,7)
  function fbm(x, y, z, octavas = 5) {
    let s = 0, amp = 0.5, f = 1, norm = 0;
    for (let o = 0; o < octavas; o++) { s += amp * ruido(x * f, y * f, z * f); norm += amp; amp *= 0.5; f *= 2.03; }
    return s / norm;
  }

  return { rnd, ruido, fbm };
}
