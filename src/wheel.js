// Roleta desenhada em <canvas>. O desenho é feito uma vez; o giro só aplica
// transform: rotate() no canvas (rápido, acelerado pela GPU).
// As funções exportadas também são usadas para gerar o vídeo do sorteio.

export const TAU = Math.PI * 2
export const POINTER = -Math.PI / 2 // ponteiro no topo
const HUB_RATIO = 0.25 // raio do botão central em relação ao raio da face

export const COLORS = [
  '#ff4d6d', '#ffb703', '#06d6a0', '#3a86ff', '#8338ec',
  '#ff7b00', '#ef476f', '#2ec4b6', '#fb5607', '#118ab2',
]
const EMPTY_COLORS = ['#3a2a6b', '#2c1f55']

export const mod = (a, n) => ((a % n) + n) % n
export const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4)

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`
}

/** Corta o texto com "…" para caber em maxWidth (usa a fonte atual do ctx). */
export function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  const chars = Array.from(text)
  let lo = 0
  let hi = chars.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (ctx.measureText(chars.slice(0, mid).join('') + '…').width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return chars.slice(0, lo).join('').trimEnd() + '…'
}

/** Cor da fatia i de n, evitando que a última fique igual à primeira. */
export function sliceColor(i, n) {
  const P = COLORS.length
  if (n > 1 && i === n - 1 && i % P === 0) return COLORS[1]
  return COLORS[i % P]
}

/** Índice da fatia que está sob o ponteiro para uma rotação. */
export function sliceIndexAt(n, rotation) {
  if (!n) return -1
  return Math.min(n - 1, Math.floor(mod(POINTER - rotation, TAU) / (TAU / n)))
}

/**
 * Planeja um giro que termina na fatia `winner` (sorteada antes, de forma justa).
 * O ponto de parada dentro da fatia é aleatório, longe das bordas. Duração em segundos.
 */
export function planSpin(n, winner, start, duration) {
  const seg = TAU / n
  const inset = seg * (0.15 + Math.random() * 0.7)
  const target = mod(POINTER - (winner * seg + inset), TAU)
  const turns = Math.max(4, Math.round(duration)) + Math.floor(Math.random() * 2)
  const total = turns * TAU + mod(target - mod(start, TAU), TAU)
  return { start, total, duration }
}

/** Rotação da roleta t segundos depois do início de um giro planejado. */
export function rotationAt(plan, t) {
  const p = Math.min(1, Math.max(0, t / plan.duration))
  return plan.start + plan.total * easeOutQuart(p)
}

/**
 * Pinta a face da roleta (fatias, pinos e nomes) centrada na origem, com raio R.
 * `highlight` escurece todas as fatias menos a vencedora.
 */
export function paintWheelFace(ctx, R, names, highlight = -1) {
  const empty = names.length === 0
  const labels = empty ? Array(8).fill('?') : names
  const n = labels.length
  const seg = TAU / n
  const colorOf = (i) => (empty ? EMPTY_COLORS[i % 2] : sliceColor(i, n))

  // Fatias
  for (let i = 0; i < n; i++) {
    const color = colorOf(i)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, R, i * seg, (i + 1) * seg)
    ctx.closePath()
    const grad = ctx.createRadialGradient(0, 0, R * 0.12, 0, 0, R)
    grad.addColorStop(0, lighten(color, 0.35))
    grad.addColorStop(0.55, color)
    grad.addColorStop(1, color)
    ctx.fillStyle = grad
    ctx.fill()
    if (highlight >= 0 && i !== highlight) {
      ctx.fillStyle = 'rgba(10, 5, 28, 0.6)'
      ctx.fill()
    }
    if (n > 1 && n <= 240) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = Math.max(1, R * 0.006)
      ctx.stroke()
    }
  }

  // Contorno brilhante na fatia vencedora
  if (highlight >= 0 && highlight < n) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, R * 0.985, highlight * seg, (highlight + 1) * seg)
    ctx.closePath()
    ctx.shadowColor = '#fff'
    ctx.shadowBlur = R * 0.08
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.lineWidth = R * 0.018
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()
  }

  // Pinos na borda (fazem o ponteiro "bater")
  if (n > 1 && n <= 72) {
    ctx.save()
    ctx.fillStyle = '#fff8e1'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
    ctx.shadowBlur = R * 0.012
    for (let i = 0; i < n; i++) {
      const a = i * seg
      ctx.beginPath()
      ctx.arc(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95, Math.max(1.5, R * 0.017), 0, TAU)
      ctx.fill()
    }
    ctx.restore()
  }

  // Nomes
  const arcSpace = seg * R * 0.55
  if (arcSpace >= 6) {
    const fontSize = Math.max(7, Math.min(R * 0.105, arcSpace * 0.85))
    const outer = R * (n <= 72 && n > 1 ? 0.88 : 0.93)
    const maxWidth = outer - R * HUB_RATIO - R * 0.05
    ctx.font = `600 ${fontSize}px Fredoka, Inter, system-ui, sans-serif`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < n; i++) {
      const color = colorOf(i)
      const dark = !empty && luminance(color) > 0.45
      const dimmed = highlight >= 0 && i !== highlight
      ctx.save()
      ctx.rotate((i + 0.5) * seg)
      ctx.globalAlpha = dimmed ? 0.45 : 1
      ctx.fillStyle = dark ? '#1d1240' : '#ffffff'
      ctx.shadowColor = dark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.45)'
      ctx.shadowBlur = fontSize * 0.25
      ctx.shadowOffsetY = fontSize * 0.05
      ctx.fillText(fitText(ctx, labels[i], maxWidth), outer, 0)
      ctx.restore()
    }
  }

  // Anel interno escuro ao redor do botão central
  ctx.beginPath()
  ctx.arc(0, 0, R * (HUB_RATIO + 0.03), 0, TAU)
  ctx.fillStyle = 'rgba(12, 6, 30, 0.35)'
  ctx.fill()
}

export class Wheel {
  constructor(canvas, { onTick } = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.onTick = onTick
    this.names = []
    this.size = 0
    this.rotation = 0
    this.highlight = -1
    this.spinning = false
    this.lastIndex = -1
    this.lastPlan = null
    this.setRotation(0)
    new ResizeObserver(() => this.resize()).observe(canvas)
  }

  setNames(names) {
    this.names = names.slice()
    this.highlight = -1
    this.lastIndex = this.indexAt(this.rotation)
    this.draw()
  }

  setHighlight(index) {
    this.highlight = index
    this.draw()
  }

  colorAt(i, n = this.names.length) {
    return sliceColor(i, n)
  }

  indexAt(rotation) {
    return sliceIndexAt(this.names.length, rotation)
  }

  currentName() {
    const i = this.indexAt(this.rotation)
    return i >= 0 ? this.names[i] : ''
  }

  setRotation(rad) {
    this.rotation = rad
    this.canvas.style.transform = `rotate(${rad}rad)`
  }

  resize() {
    const size = Math.round(this.canvas.clientWidth)
    if (size && size !== this.size) {
      this.size = size
      this.draw()
    }
  }

  /**
   * Gira até a fatia `winner` e resolve ao parar. O plano do giro fica em
   * `lastPlan` para o vídeo poder reproduzir exatamente o mesmo movimento.
   */
  spin(winner, duration = 6000) {
    const n = this.names.length
    if (this.spinning || !n) return Promise.resolve(-1)
    this.spinning = true
    this.setHighlight(-1)

    const plan = planSpin(n, winner, this.rotation, duration / 1000)
    this.lastPlan = plan
    const t0 = performance.now()

    return new Promise((resolve) => {
      const frame = (now) => {
        const t = (now - t0) / 1000
        const rot = rotationAt(plan, t)
        this.setRotation(rot)
        const idx = this.indexAt(rot)
        if (idx !== this.lastIndex) {
          this.lastIndex = idx
          this.onTick?.(idx, this.names[idx])
        }
        if (t < plan.duration) {
          requestAnimationFrame(frame)
        } else {
          this.setRotation(mod(rot, TAU))
          this.spinning = false
          resolve(winner)
        }
      }
      requestAnimationFrame(frame)
    })
  }

  draw() {
    const { ctx, size } = this
    if (!size) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = size * dpr
    this.canvas.height = size * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)
    ctx.save()
    ctx.translate(size / 2, size / 2)
    paintWheelFace(ctx, size / 2, this.names, this.highlight)
    ctx.restore()
  }
}
