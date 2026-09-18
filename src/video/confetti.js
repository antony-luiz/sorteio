// Confete para o vídeo: mesma física do canvas-confetti usado no site,
// mas avançando em passos fixos (60 por segundo) para renderizar quadro a quadro.

/** Gerador pseudoaleatório com semente (o vídeo sai igual se gerado de novo). */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const CONFETTI_COLORS = ['#ff4d8d', '#ffd166', '#06d6a0', '#3a86ff', '#8338ec', '#ff7b00', '#ffffff']
export const STEP = 1 / 60

/**
 * @param scale multiplica tamanhos e velocidades (o canvas-confetti foi pensado para pixels CSS)
 */
export function createConfetti({ width, height, scale, rand }) {
  const parts = []

  function emit({
    count, x, y, angle = 90, spread = 45, velocity = 45, decay = 0.9, gravity = 1,
    ticks = 200, scalar = 1, shapes = ['square', 'circle'],
  }) {
    const radAngle = (angle * Math.PI) / 180
    const radSpread = (spread * Math.PI) / 180
    for (let i = 0; i < count; i++) {
      parts.push({
        x: x * width,
        y: y * height,
        wobble: rand() * 10,
        wobbleSpeed: Math.min(0.11, rand() * 0.1 + 0.05),
        velocity: (velocity * 0.5 + rand() * velocity) * scale,
        angle: -radAngle + (0.5 * radSpread - rand() * radSpread),
        tilt: (rand() * 0.5 + 0.25) * Math.PI,
        color: CONFETTI_COLORS[Math.floor(rand() * CONFETTI_COLORS.length)],
        shape: shapes[Math.floor(rand() * shapes.length)],
        tick: 0,
        total: ticks,
        decay,
        gravity: gravity * 3 * scale,
        scalar: scalar * scale,
        random: 2,
        wx: 0,
        wy: 0,
      })
    }
  }

  function step() {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      p.x += Math.cos(p.angle) * p.velocity
      p.y += Math.sin(p.angle) * p.velocity + p.gravity
      p.velocity *= p.decay
      p.wobble += p.wobbleSpeed
      p.wx = p.x + 10 * p.scalar * Math.cos(p.wobble)
      p.wy = p.y + 10 * p.scalar * Math.sin(p.wobble)
      p.tilt += 0.1
      p.random = rand() + 2
      if (++p.tick >= p.total) parts.splice(i, 1)
    }
  }

  function draw(ctx) {
    for (const p of parts) {
      const tiltCos = Math.cos(p.tilt) * p.random * scale
      const tiltSin = Math.sin(p.tilt) * p.random * scale
      const x1 = p.x + tiltCos
      const y1 = p.y + tiltSin
      const x2 = p.wx + tiltCos
      const y2 = p.wy + tiltSin
      ctx.globalAlpha = 1 - p.tick / p.total
      ctx.fillStyle = p.color
      ctx.beginPath()
      if (p.shape === 'circle') {
        ctx.ellipse(p.x, p.y, Math.abs(x2 - x1) * 0.6, Math.abs(y2 - y1) * 0.6, (Math.PI / 10) * p.wobble, 0, 2 * Math.PI)
      } else if (p.shape === 'star') {
        let rot = (Math.PI / 2) * 3
        const inner = 4 * p.scalar
        const outer = 8 * p.scalar
        const stepAngle = Math.PI / 5
        for (let s = 0; s < 5; s++) {
          ctx.lineTo(p.x + Math.cos(rot) * outer, p.y + Math.sin(rot) * outer)
          rot += stepAngle
          ctx.lineTo(p.x + Math.cos(rot) * inner, p.y + Math.sin(rot) * inner)
          rot += stepAngle
        }
      } else {
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.wx, y1)
        ctx.lineTo(x2, y2)
        ctx.lineTo(x1, p.wy)
      }
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  return { emit, step, draw, get count() { return parts.length } }
}

/**
 * Mesma comemoração do site (efeito celebrate): explosão central, estrelas,
 * canhões laterais por 2,6 s e 7 fogos. `tick` conta passos de 1/60 s desde a parada.
 */
export function celebrationAt(confetti, tick, rand) {
  if (tick === 0) {
    confetti.emit({ count: 150, spread: 95, velocity: 52, x: 0.5, y: 0.62, scalar: 1.1 })
    confetti.emit({ count: 50, spread: 130, velocity: 40, x: 0.5, y: 0.62, shapes: ['star'], scalar: 1.5 })
  }
  if (tick < 156) {
    confetti.emit({ count: 3, angle: 60, spread: 60, velocity: 58, x: 0, y: 0.8 })
    confetti.emit({ count: 3, angle: 120, spread: 60, velocity: 58, x: 1, y: 0.8 })
  }
  // fogos a cada 420 ms (7 vezes)
  for (let k = 1; k <= 7; k++) {
    if (tick === Math.round(k * 0.42 * 60)) {
      confetti.emit({
        count: 45, spread: 360, velocity: 26, gravity: 0.7, ticks: 90, decay: 0.92,
        shapes: ['star', 'circle'], x: 0.15 + rand() * 0.7, y: 0.12 + rand() * 0.3,
      })
    }
  }
}
