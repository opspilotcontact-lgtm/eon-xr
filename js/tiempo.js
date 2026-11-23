// El reloj de la partida: el sol orbita el planeta y su velocidad angular ES la velocidad del tiempo.
// Girarlo rápido = pasan eras; sujetarlo quieto = pausa. El sentido da igual: el tiempo solo avanza.
export const OMEGA0 = Math.PI * 2 / 12;   // una vuelta cada 12 s = ritmo normal
const VEL_MAX = 10;                        // como mucho ×10 la velocidad angular normal
const RITMO = 0.0012;                      // p por segundo a ritmo normal (partida entera ≈ 14 min)

const envolver = d => { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export function crearReloj() {
  let ang = 0.6, omega = OMEGA0, agarrado = false, angPrev = 0;
  const limitar = () => { const m = VEL_MAX * OMEGA0; omega = Math.max(-m, Math.min(m, omega)); };
  return {
    get ang() { return ang; },
    get agarrado() { return agarrado; },
    get velocidad() { return Math.min(VEL_MAX, Math.abs(omega) / OMEGA0); },
    agarrar(a) { agarrado = true; angPrev = a; },
    // mientras está agarrado se llama cada fotograma con el ángulo de la mano (o del ratón)
    mover(a, dt) {
      const d = envolver(a - angPrev); angPrev = a; ang += d;
      if (dt > 0) { omega += (d / dt - omega) * (1 - Math.exp(-dt / 0.12)); limitar(); }
    },
    soltar() { agarrado = false; if (Math.abs(omega) < 0.25 * OMEGA0) omega = 0; },
    fijar(s) { omega = (Math.sign(omega) || 1) * s * OMEGA0; },
    frenar(max = 1.5) { if (!agarrado && Math.abs(omega) > max * OMEGA0) omega = Math.sign(omega) * max * OMEGA0; },
    // avanza el sol y devuelve cuánto avanza la partida (dp)
    paso(dt) {
      if (!agarrado && omega !== 0) {
        // suelto: vuelve poco a poco al ritmo normal (deprisa si iba lento, despacio si iba rápido)
        const v = Math.abs(omega), tau = v > OMEGA0 ? 5 : 1.5;
        omega += (Math.sign(omega) * OMEGA0 - omega) * (1 - Math.exp(-dt / tau));
        ang += omega * dt;
      }
      const s = this.velocidad;
      return RITMO * s * s * dt;
    },
  };
}
