// Cena do vídeo do sorteio: só a roleta (repetindo exatamente o giro que
// aconteceu na tela) e o cartão do ganhador, desenhados quadro a quadro.
import { paintWheelFace, sliceColor, sliceIndexAt, rotationAt, fitText, TAU, POINTER } from '../wheel.js'
import { createConfetti, celebrationAt, mulberry32, STEP } from './confetti.js'

export const FPS = 30
export const FORMATS = {
  vertical: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
}

const INTRO = 0.8 // roleta parada antes do giro
const HOLD = 1.3 // roleta parada no ganhador antes do cartão
const OUTRO = 4.2 // cartão do ganhador na tela
const TICK_GAP = 0.04 // igual ao site: no máximo 25 "tecs" por segundo

const DISPLAY = 'Fredoka, Inter, system-ui, sans-serif'
const BODY = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const LOGO_COLORS = ['#ff4d6d', '#ffb703', '#06d6a0', '#3a86ff', '#8338ec', '#ff7b00']
const TROPHY = 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3'
const POINTER_PATH = 'M30 77C22 60 6 44 6 28a24 24 0 1 1 48 0c0 16-16 32-24 49z'
const SCRAMBLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÇ0123456789'

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const lerp = (a, b, t) => a + (b - a) * t
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3)
const easeInOut = (x) => -(Math.cos(Math.PI * x) - 1) / 2
const easeOutBack = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2)

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** Momentos do vídeo, em segundos. */
export function timeline(plan) {
  const spin = INTRO
  const stop = spin + plan.duration
  const card = stop + HOLD
  return { spin, stop, card, end: card + OUTRO }
}

/**
 * Instantes (s desde o início do giro) em que o ponteiro passa por um pino.
 * A fatia muda quando a rotação cruza POINTER − m·fatia; invertendo o easing
 * (easeOutQuart) chega-se ao instante exato de cada cruzamento.
 */
export function tickTimes(n, plan) {
  const seg = TAU / n
  const { start, total, duration } = plan
  const times = []
  let last = -Infinity
  const mHi = Math.ceil((POINTER - start) / seg) - 1
  const mLo = Math.ceil((POINTER - start - total) / seg)
  for (let m = mHi; m >= mLo; m--) {
    const x = (POINTER - m * seg - start) / total
    if (x <= 0 || x > 1) continue
    const t = duration * (1 - Math.pow(1 - x, 0.25))
    if (t - last >= TICK_GAP) {
      times.push(t)
      last = t
    }
  }
  return times
}

function formatDate(ts) {
  const d = new Date(ts)
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${date} às ${time}`
}

function sprite(w, h, paint) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  paint(c.getContext('2d'), c.width, c.height)
  return c
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function starPath(ctx, x, y, outer, inner) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  ctx.closePath()
}

/** Gradiente linear no estilo CSS (ângulo em graus) cobrindo a caixa. */
function cssLinear(ctx, x, y, w, h, deg, stops) {
  const a = (deg * Math.PI) / 180
  const dx = Math.sin(a)
  const dy = -Math.cos(a)
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2
  const cx = x + w / 2
  const cy = y + h / 2
  const g = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half)
  stops.forEach(([o, color]) => g.addColorStop(o, color))
  return g
}

function setSpacing(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`
}

async function loadFonts() {
  if (!document.fonts?.load) return
  const specs = ['600 40px Fredoka', '700 40px Fredoka', '500 30px Inter', '600 30px Inter', '700 30px Inter']
  await Promise.race([
    Promise.all(specs.map((s) => document.fonts.load(s).catch(() => null))),
    new Promise((r) => setTimeout(r, 4000)),
  ])
}

/** Posições e tamanhos para cada formato (valores pensados para 1080 px de largura). */
function layout(W, H) {
  const u = W / 1080
  if (H > W * 1.4) {
    const S = 960 * u
    return {
      u, q: u, S, cx: W / 2, cy: 440 * u + S / 2,
      title: { y: 262 * u, size: 80 * u },
      sub: { y: 342 * u, size: 34 * u },
      ticker: { y: 1500 * u, h: 116 * u, w: 900 * u, size: 54 * u },
      credit: { y: H - 120 * u, size: 30 * u },
      card: { y: H * 0.49, w: 900 * u },
    }
  }
  const S = 720 * u
  return {
    u, q: u * 0.8, S, cx: W / 2, cy: 180 * u + S / 2,
    title: { y: 62 * u, size: 54 * u },
    sub: { y: 112 * u, size: 26 * u },
    ticker: { y: 962 * u, h: 72 * u, w: 760 * u, size: 36 * u },
    credit: { y: H - 34 * u, size: 22 * u },
    card: { y: H * 0.5, w: 820 * u },
  }
}

// ---------- partes fixas (pré-desenhadas uma vez) ----------

function paintBackground(c, W, H) {
  c.fillStyle = cssLinear(c, 0, 0, W, H, 160, [[0, '#0b0620'], [1, '#160b38']])
  c.fillRect(0, 0, W, H)
  const m = Math.max(W, H)
  const blob = (x, y, r, color, a) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, rgba(color, a))
    g.addColorStop(1, rgba(color, 0))
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
  }
  blob(W * 0.08, -H * 0.1, m * 0.75, '#2c1266', 1)
  blob(W * 1.05, H * 1.1, m * 0.65, '#43104f', 1)
  blob(W * 0.05, H * 0.08, m * 0.42, '#ff4d8d', 0.2)
  blob(W * 0.95, H * 0.9, m * 0.42, '#7c5cff', 0.22)
  blob(W * 0.55, H * 0.5, m * 0.3, '#00c2ff', 0.06)
}

function paintLogo(c, x, y, r) {
  c.save()
  c.translate(x, y)
  c.shadowColor = 'rgba(255, 77, 141, 0.5)'
  c.shadowBlur = r * 0.6
  c.beginPath()
  c.arc(0, 0, r, 0, TAU)
  c.fillStyle = '#f6b73c'
  c.fill()
  c.shadowColor = 'transparent'
  LOGO_COLORS.forEach((color, i) => {
    c.beginPath()
    c.moveTo(0, 0)
    c.arc(0, 0, r * 0.84, -Math.PI / 2 + (i * TAU) / 6, -Math.PI / 2 + ((i + 1) * TAU) / 6)
    c.closePath()
    c.fillStyle = color
    c.fill()
  })
  c.beginPath()
  c.arc(0, 0, r * 0.23, 0, TAU)
  c.fillStyle = '#fff'
  c.fill()
  c.restore()
}

function paintHeader(c, L, W, subtitle) {
  const { title, sub, u } = L
  const text = 'Roleta da Sorte'
  c.font = `700 ${title.size}px ${DISPLAY}`
  const tw = c.measureText(text).width
  const logoR = title.size * 0.56
  const gap = title.size * 0.3
  const x0 = (W - (logoR * 2 + gap + tw)) / 2
  paintLogo(c, x0 + logoR, title.y, logoR)

  const tx = x0 + logoR * 2 + gap
  const g = c.createLinearGradient(tx, 0, tx + tw, 0)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.5, '#ffd166')
  g.addColorStop(1, '#ff4d8d')
  c.save()
  c.shadowColor = 'rgba(255, 77, 141, 0.45)'
  c.shadowBlur = 30 * u
  c.fillStyle = g
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  c.fillText(text, tx, title.y)
  c.restore()

  c.font = `500 ${sub.size}px ${BODY}`
  c.fillStyle = '#c9c3e6'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(subtitle, W / 2, sub.y)
}

function paintCredit(c, w, h, size) {
  const parts = [
    ['by ', `500 ${size}px ${BODY}`, 'rgba(255, 255, 255, 0.65)'],
    ['Antony Luiz dev', `700 ${size}px ${BODY}`, '#ffffff'],
    ['  ·  ', `500 ${size}px ${BODY}`, 'rgba(255, 255, 255, 0.4)'],
    ['antonyluiz.dev', `600 ${size}px ${BODY}`, '#ffd166'],
  ]
  let total = 0
  for (const [text, font] of parts) {
    c.font = font
    total += c.measureText(text).width
  }
  let x = (w - total) / 2
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  c.shadowColor = 'rgba(0, 0, 0, 0.6)'
  c.shadowBlur = size * 0.5
  for (const [text, font, color] of parts) {
    c.font = font
    c.fillStyle = color
    c.fillText(text, x, h / 2)
    x += c.measureText(text).width
  }
}

function paintRim(c, o, S) {
  const R = S / 2
  c.save()
  c.shadowColor = 'rgba(0, 0, 0, 0.75)'
  c.shadowBlur = S * 0.06
  c.shadowOffsetY = S * 0.03
  c.beginPath()
  c.arc(o, o, R, 0, TAU)
  c.fillStyle = '#6b3a00'
  c.fill()
  c.restore()

  c.save()
  c.shadowColor = 'rgba(255, 170, 60, 0.4)'
  c.shadowBlur = S * 0.05
  c.beginPath()
  c.arc(o, o, R, 0, TAU)
  c.fillStyle = cssLinear(c, o - R, o - R, S, S, 145, [
    [0, '#ffe7a3'], [0.28, '#f6b73c'], [0.6, '#c77a0a'], [1, '#8a4b00'],
  ])
  c.fill()
  c.restore()

  c.lineWidth = S * 0.004
  c.strokeStyle = 'rgba(255, 255, 255, 0.35)'
  c.beginPath()
  c.arc(o, o, R - c.lineWidth / 2, 0, TAU)
  c.stroke()
  c.lineWidth = S * 0.01
  c.strokeStyle = 'rgba(60, 25, 0, 0.55)'
  c.beginPath()
  c.arc(o, o, S * 0.445 + c.lineWidth / 2, 0, TAU)
  c.stroke()
}

function radialSprite(size, stops) {
  return sprite(size, size, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
    stops.forEach(([o, color]) => g.addColorStop(o, color))
    c.fillStyle = g
    c.fillRect(0, 0, w, w)
  })
}

/** Partículas brilhantes subindo no fundo (como no site); aceleram no giro. */
function createMotes(W, H, u, rand) {
  const HUES = [340, 45, 160, 205, 265]
  const count = Math.round(Math.min(70, (W * H) / 30000))
  const list = Array.from({ length: count }, () => ({
    x: rand() * W,
    y: rand() * H,
    r: (0.8 + rand() * 2.2) * 1.8 * u,
    vy: (8 + rand() * 22) * 2.2 * u,
    vx: (rand() - 0.5) * 10 * u,
    ph: rand() * TAU,
    hue: HUES[Math.floor(rand() * HUES.length)],
  }))
  let boost = 0
  return (ctx, t, dt, spinning) => {
    boost += ((spinning ? 1 : 0) - boost) * Math.min(1, dt * 2.5)
    const speed = 1 + boost * 6
    for (const p of list) {
      p.y -= p.vy * dt * speed
      p.x += (p.vx + Math.sin(t + p.ph) * 8 * u) * dt * (1 + boost * 2)
      if (p.y < -12 * u) {
        p.y = H + 10 * u
        p.x = rand() * W
      }
      if (p.x < -12 * u) p.x = W + 10 * u
      else if (p.x > W + 12 * u) p.x = -10 * u
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.67 + p.ph))
      const r = p.r * (1 + boost * 0.7)
      ctx.fillStyle = `hsla(${p.hue}, 95%, 70%, ${a * 0.16})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, r * 4, 0, TAU)
      ctx.fill()
      ctx.fillStyle = `hsla(${p.hue}, 95%, 78%, ${a})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, TAU)
      ctx.fill()
    }
  }
}

/**
 * Monta a cena. `draw` = { names, index, winner, plan, at } — o sorteio que
 * aconteceu. Devolve o número de quadros, a função que desenha cada quadro e
 * os tempos da trilha sonora.
 */
export async function createScene(canvas, draw) {
  await loadFonts()

  const W = canvas.width
  const H = canvas.height
  const ctx = canvas.getContext('2d')
  const L = layout(W, H)
  const { u, q, S, cx, cy } = L
  const n = draw.names.length
  const T = timeline(draw.plan)
  const frames = Math.ceil(T.end * FPS)
  const ticks = tickTimes(n, draw.plan)
  const winnerColor = sliceColor(draw.index, n)
  const dateText = formatDate(draw.at)
  const countText = `${n} ${n === 1 ? 'nome' : 'nomes'}`
  const rand = mulberry32(Math.floor(draw.at % 2147483647) || 7)

  // ---- partes fixas ----
  const bg = sprite(W, H, (c) => {
    paintBackground(c, W, H)
    paintHeader(c, L, W, `${dateText}  ·  ${countText}`)
  })
  const credit = sprite(W, L.credit.size * 2.4, (c, w, h) => paintCredit(c, w, h, L.credit.size))
  const faceSize = S * 0.89
  const face = sprite(faceSize, faceSize, (c, w) => {
    c.translate(w / 2, w / 2)
    paintWheelFace(c, w / 2, draw.names)
  })
  const faceWin = sprite(faceSize, faceSize, (c, w) => {
    c.translate(w / 2, w / 2)
    paintWheelFace(c, w / 2, draw.names, draw.index)
  })
  const rimPad = S * 0.1
  const rim = sprite(S + rimPad * 2, S + rimPad * 2, (c, w) => paintRim(c, w / 2, S))
  const shine = sprite(faceSize, faceSize, (c, D) => {
    c.beginPath()
    c.arc(D / 2, D / 2, D / 2, 0, TAU)
    c.clip()
    let g = c.createRadialGradient(0.32 * D, 0.22 * D, 0, 0.32 * D, 0.22 * D, 0.435 * D)
    g.addColorStop(0, 'rgba(255, 255, 255, 0.26)')
    g.addColorStop(1, 'rgba(255, 255, 255, 0)')
    c.fillStyle = g
    c.fillRect(0, 0, D, D)
    g = c.createRadialGradient(D / 2, D / 2, 0.438 * D, D / 2, D / 2, 0.707 * D)
    g.addColorStop(0, 'rgba(0, 0, 0, 0)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0.32)')
    c.fillStyle = g
    c.fillRect(0, 0, D, D)
  })
  const haloSize = S * 1.36
  const haloPink = radialSprite(haloSize, [
    [0, 'rgba(255, 77, 141, 0.5)'], [0.5, 'rgba(124, 92, 255, 0.28)'], [0.83, 'rgba(124, 92, 255, 0)'],
  ])
  const haloGold = radialSprite(haloSize, [
    [0, 'rgba(255, 209, 102, 0.6)'], [0.5, 'rgba(255, 77, 141, 0.35)'], [0.86, 'rgba(255, 77, 141, 0)'],
  ])
  const bulbR = S * 0.014
  const bulbGlow = radialSprite(bulbR * 9, [
    [0, 'rgba(255, 209, 102, 0.95)'], [0.3, 'rgba(255, 209, 102, 0.45)'], [1, 'rgba(255, 209, 102, 0)'],
  ])
  const bulbHot = radialSprite(bulbR * 10, [
    [0, 'rgba(255, 255, 255, 1)'], [0.25, 'rgba(255, 140, 180, 0.6)'], [1, 'rgba(255, 77, 141, 0)'],
  ])
  const bulbCore = sprite(bulbR * 2 + 2, bulbR * 2 + 2, (c, w) => {
    c.beginPath()
    c.arc(w / 2, w / 2, bulbR, 0, TAU)
    c.fillStyle = '#fff7da'
    c.fill()
  })
  const hubR = S * 0.11
  const hub = sprite(hubR * 2.8, hubR * 2.8, (c, w) => {
    const o = w / 2
    c.save()
    c.shadowColor = 'rgba(0, 0, 0, 0.45)'
    c.shadowBlur = S * 0.03
    c.shadowOffsetY = S * 0.014
    c.beginPath()
    c.arc(o, o, hubR, 0, TAU)
    c.fillStyle = '#fff4d6'
    c.fill()
    c.restore()
    const r = hubR - S * 0.009
    const gx = o - 0.3 * r
    const gy = o - 0.4 * r
    const g = c.createRadialGradient(gx, gy, 0, gx, gy, 1.9 * r)
    g.addColorStop(0, '#ff9dbd')
    g.addColorStop(0.45, '#ff4d8d')
    g.addColorStop(1, '#b3124f')
    c.beginPath()
    c.arc(o, o, r, 0, TAU)
    c.fillStyle = g
    c.fill()
    c.shadowColor = 'rgba(0, 0, 0, 0.3)'
    c.shadowBlur = r * 0.1
    c.shadowOffsetY = r * 0.04
    starPath(c, o, o + r * 0.04, r * 0.52, r * 0.22)
    c.fillStyle = '#ffffff'
    c.fill()
  })
  const flash = sprite(W, H, (c) => {
    const x = W / 2
    const y = H * 0.45
    const r = Math.hypot(W / 2, H * 0.55)
    const g = c.createRadialGradient(x, y, 0, x, y, r * 0.7)
    g.addColorStop(0, 'rgba(255, 244, 214, 0.85)')
    g.addColorStop(0.57, 'rgba(255, 209, 102, 0.25)')
    g.addColorStop(1, 'rgba(255, 209, 102, 0)')
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
  })
  const pointerPath = new Path2D(POINTER_PATH)
  const pointerFill = ctx.createLinearGradient(0, 4, 0, 77)
  pointerFill.addColorStop(0, '#ff8fb3')
  pointerFill.addColorStop(1, '#e0144f')
  const trophyPath = new Path2D(TROPHY)

  // ---- medidas do cartão do ganhador ----
  const card = {
    w: L.card.w, pad: 60 * q, padTop: 72 * q, trophyR: 96 * q, gap1: 34 * q, eyebrow: 30 * q,
    gap2: 22 * q, gap3: 24 * q, meta: 36 * q, gap4: 12 * q, date: 30 * q, padBottom: 70 * q,
  }
  let nameSize = 150 * q
  const nameMax = card.w - card.pad * 2
  ctx.font = `700 ${nameSize}px ${DISPLAY}`
  while (ctx.measureText(draw.winner).width > nameMax && nameSize > 46 * q) {
    nameSize -= 2 * q
    ctx.font = `700 ${nameSize}px ${DISPLAY}`
  }
  const winnerLabel = fitText(ctx, draw.winner, nameMax)
  const nameWidth = ctx.measureText(winnerLabel).width
  const nameLine = nameSize * 1.15
  card.h = card.padTop + card.trophyR * 2 + card.gap1 + card.eyebrow + card.gap2 + nameLine
    + card.gap3 + card.meta + card.gap4 + card.date + card.padBottom

  const drawMotes = createMotes(W, H, u, rand)
  const confetti = createConfetti({ width: W, height: H, scale: 2.4 * u, rand })
  let confettiTick = 0
  let tickIdx = -1

  // ---- desenho de cada parte ----

  function rotated(img, angle, alpha = 1) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    ctx.restore()
  }

  function drawHalo(t) {
    const breathe = (1 - Math.cos((t / 4) * TAU)) / 2
    const size = haloSize * (0.96 + 0.08 * breathe)
    const alpha = 0.75 + 0.25 * breathe
    const gold = t < T.spin ? 0 : clamp01((t - T.spin) / 0.4)
    ctx.globalAlpha = alpha * (1 - gold)
    ctx.drawImage(haloPink, cx - size / 2, cy - size / 2, size, size)
    ctx.globalAlpha = alpha * gold
    ctx.drawImage(haloGold, cx - size / 2, cy - size / 2, size, size)
    ctx.globalAlpha = 1
  }

  function drawRim(t) {
    ctx.drawImage(rim, cx - rim.width / 2, cy - rim.height / 2)
    const w = t - T.stop
    if (w >= 0 && w < 2) {
      // aro piscando mais claro quando sai o ganhador (4 pulsos)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.3 * Math.sin(Math.PI * ((w / 0.5) % 1))
      ctx.drawImage(rim, cx - rim.width / 2, cy - rim.height / 2)
      ctx.restore()
    }
  }

  function drawBulbs(t) {
    const R = S * 0.473
    const spinning = t >= T.spin && t < T.stop
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * TAU
      const x = cx + Math.sin(a) * R
      const y = cy - Math.cos(a) * R
      let b
      if (spinning) {
        // luz correndo em volta (mesma animação "chase" do site)
        const p = ((t - T.spin + k * 0.06) % 1.44) / 1.44
        b = p < 0.08 ? 0.3 + 0.7 * (p / 0.08) : 1 - 0.7 * ((p - 0.08) / 0.92)
      } else {
        const [period, base] = t >= T.stop ? [0.35, t - T.stop] : [1.6, t]
        const shift = k % 2 === 1 ? period / 2 : 0
        b = (base + shift) % period < period / 2 ? 1 : 0.3
      }
      const glow = (b - 0.3) / 0.7
      if (glow > 0.02) {
        const img = spinning ? bulbHot : bulbGlow
        ctx.globalAlpha = glow
        ctx.drawImage(img, x - img.width / 2, y - img.height / 2)
      }
      ctx.globalAlpha = b
      ctx.drawImage(bulbCore, x - bulbCore.width / 2, y - bulbCore.height / 2)
    }
    ctx.globalAlpha = 1
  }

  function drawFace(t, rot) {
    if (t >= T.spin && t < T.stop) {
      // desfoque de movimento: média de várias posições dentro do "obturador"
      const tS = t - T.spin
      const shutter = 0.5 / FPS
      const from = rotationAt(draw.plan, Math.max(0, tS - shutter))
      const samples = Math.max(1, Math.min(16, Math.ceil(Math.abs(rot - from) / (TAU / 240))))
      for (let s = 0; s < samples; s++) {
        const a = samples === 1 ? rot : rotationAt(draw.plan, tS - shutter * (1 - s / (samples - 1)))
        rotated(face, a, 1 / (s + 1))
      }
    } else {
      rotated(face, rot)
      const k = clamp01((t - T.stop) / 0.3)
      if (k > 0) rotated(faceWin, rot, k)
    }
    ctx.drawImage(shine, cx - shine.width / 2, cy - shine.height / 2)
  }

  function drawPointer(t) {
    const tS = t - T.spin
    while (tickIdx + 1 < ticks.length && ticks[tickIdx + 1] <= tS) tickIdx++
    let angle = 0
    if (tickIdx >= 0) {
      const dt = tS - ticks[tickIdx]
      if (dt < 0.17) angle = ((-24 * Math.PI) / 180) * (1 - easeOutCubic(dt / 0.17))
    }
    const ps = (S * 0.12) / 60
    ctx.save()
    ctx.translate(cx - S / 2 + S * 0.44 + 30 * ps, cy - S / 2 - S * 0.045 + 24 * ps)
    ctx.rotate(angle)
    ctx.scale(ps, ps)
    ctx.translate(-30, -24)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = S * 0.012
    ctx.shadowOffsetY = S * 0.008
    ctx.fillStyle = pointerFill
    ctx.fill(pointerPath)
    ctx.shadowColor = 'transparent'
    ctx.lineWidth = 3
    ctx.strokeStyle = '#fff'
    ctx.stroke(pointerPath)
    ctx.beginPath()
    ctx.arc(30, 28, 8, 0, TAU)
    ctx.fillStyle = '#ffd166'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
  }

  function drawTrophyIcon(x, y, size, color) {
    ctx.save()
    ctx.translate(x - size / 2, y - size / 2)
    ctx.scale(size / 24, size / 24)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.stroke(trophyPath)
    ctx.restore()
  }

  function drawTicker(t, rot) {
    const { y, h, w, size } = L.ticker
    const won = t >= T.stop
    let text = `Sorteando entre ${countText}…`
    let color = '#c9c3e6'
    let border = 'rgba(255, 255, 255, 0.14)'
    let scale = 1
    if (won) {
      text = draw.winner
      color = '#ffd166'
      border = 'rgba(255, 209, 102, 0.7)'
      const p = clamp01((t - T.stop) / 0.55)
      scale = p < 0.6 ? lerp(0.85, 1.08, easeOutCubic(p / 0.6)) : lerp(1.08, 1, easeInOut((p - 0.6) / 0.4))
    } else if (t >= T.spin) {
      text = draw.names[sliceIndexAt(n, rot)]
      color = '#ffffff'
      border = 'rgba(255, 77, 141, 0.55)'
    }
    ctx.save()
    ctx.translate(cx, y)
    ctx.scale(scale, scale)
    roundRect(ctx, -w / 2, -h / 2, w, h, h / 2)
    if (won) {
      ctx.save()
      ctx.shadowColor = 'rgba(255, 209, 102, 0.55)'
      ctx.shadowBlur = 34 * u
      ctx.fillStyle = 'rgba(40, 20, 50, 0.9)'
      ctx.fill()
      ctx.restore()
      ctx.fillStyle = cssLinear(ctx, -w / 2, -h / 2, w, h, 135, [
        [0, 'rgba(255, 209, 102, 0.22)'], [1, 'rgba(255, 77, 141, 0.24)'],
      ])
    } else {
      ctx.fillStyle = 'rgba(8, 4, 24, 0.62)'
    }
    ctx.fill()
    ctx.lineWidth = 2 * u
    ctx.strokeStyle = border
    ctx.stroke()

    ctx.font = `600 ${size}px ${DISPLAY}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const icon = won ? size * 0.95 : 0
    const gap = won ? size * 0.35 : 0
    const label = fitText(ctx, text, w - h - icon - gap)
    const total = icon + gap + ctx.measureText(label).width
    let x = -total / 2
    if (won) {
      drawTrophyIcon(x + icon / 2, 0, icon, color)
      x += icon + gap
    }
    ctx.fillStyle = color
    ctx.fillText(label, x, size * 0.04)
    ctx.restore()
  }

  function scrambled(text, p) {
    const chars = Array.from(text)
    const shown = Math.floor(p * chars.length)
    return chars
      .map((ch, i) => (i < shown || ch === ' ' ? ch : SCRAMBLE[Math.floor(rand() * SCRAMBLE.length)]))
      .join('')
  }

  function drawCard(c) {
    ctx.fillStyle = `rgba(8, 3, 22, ${0.74 * clamp01(c / 0.35)})`
    ctx.fillRect(0, 0, W, H)

    const { w, h } = card
    const appear = clamp01(c / 0.3)
    const grow = clamp01(c / 0.65)
    const top = -h / 2
    ctx.save()
    ctx.translate(cx, L.card.y + (1 - easeOutCubic(grow)) * 40 * u)
    ctx.scale(0.6 + 0.4 * easeOutBack(grow), 0.6 + 0.4 * easeOutBack(grow))
    ctx.globalAlpha = appear

    // caixa com brilho na cor da fatia vencedora
    ctx.save()
    roundRect(ctx, -w / 2, top, w, h, 44 * q)
    ctx.shadowColor = winnerColor
    ctx.shadowBlur = 90 * u
    ctx.fillStyle = cssLinear(ctx, -w / 2, top, w, h, 165, [[0, '#2b1569'], [0.55, '#1b0c42'], [1, '#12072e']])
    ctx.fill()
    ctx.restore()

    // raios de luz girando atrás do troféu
    const trophyY = top + card.padTop + card.trophyR
    ctx.save()
    roundRect(ctx, -w / 2, top, w, h, 44 * q)
    ctx.clip()
    ctx.translate(0, trophyY)
    ctx.rotate((c * TAU) / 16)
    const rayR = 560 * q
    const rays = ctx.createRadialGradient(0, 0, 0, 0, 0, rayR)
    rays.addColorStop(0, 'rgba(255, 209, 102, 0.2)')
    rays.addColorStop(1, 'rgba(255, 209, 102, 0)')
    ctx.fillStyle = rays
    ctx.beginPath()
    for (let i = 0; i < 20; i++) {
      const a = (i * TAU) / 20
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, rayR, a, a + TAU / 40)
      ctx.closePath()
    }
    ctx.fill()
    ctx.restore()

    roundRect(ctx, -w / 2, top, w, h, 44 * q)
    ctx.lineWidth = 2 * u
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
    ctx.stroke()

    // troféu entrando com giro e mola, depois flutuando
    const tp = clamp01((c - 0.15) / 0.9)
    let ts
    let tr
    if (tp < 0.7) {
      const e = easeOutCubic(tp / 0.7)
      ts = lerp(0.2, 1.12, e)
      tr = lerp(-35, 8, e)
    } else {
      const e = easeInOut((tp - 0.7) / 0.3)
      ts = lerp(1.12, 1, e)
      tr = lerp(8, 0, e)
    }
    const bob = c > 1.05 ? (-8 * q * (1 - Math.cos(((c - 1.05) / 3) * TAU))) / 2 : 0
    const R = card.trophyR
    ctx.save()
    ctx.translate(0, trophyY + bob)
    ctx.rotate((tr * Math.PI) / 180)
    ctx.scale(ts, ts)
    ctx.globalAlpha = appear * clamp01(tp / 0.25)
    ctx.beginPath()
    ctx.arc(0, 0, R + 9 * q, 0, TAU)
    ctx.fillStyle = 'rgba(255, 209, 102, 0.14)'
    ctx.fill()
    ctx.shadowColor = 'rgba(255, 209, 102, 0.6)'
    ctx.shadowBlur = 60 * u
    const tg = ctx.createRadialGradient(-0.3 * R, -0.4 * R, 0, -0.3 * R, -0.4 * R, 1.9 * R)
    tg.addColorStop(0, '#fff5cc')
    tg.addColorStop(0.42, '#ffd166')
    tg.addColorStop(1, '#f59e0b')
    ctx.beginPath()
    ctx.arc(0, 0, R, 0, TAU)
    ctx.fillStyle = tg
    ctx.fill()
    ctx.shadowColor = 'transparent'
    const iconScale = (R * 2 * 0.52) / 24
    ctx.scale(iconScale, iconScale)
    ctx.translate(-12, -12)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.fill(trophyPath)
    ctx.lineWidth = 1.8
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#7a3d00'
    ctx.stroke(trophyPath)
    ctx.restore()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // "E O GANHADOR É…"
    let y = top + card.padTop + R * 2 + card.gap1 + card.eyebrow / 2
    const e1 = easeOutCubic(clamp01((c - 0.25) / 0.5))
    ctx.globalAlpha = appear * e1
    ctx.font = `700 ${card.eyebrow}px ${BODY}`
    ctx.fillStyle = '#ffd166'
    setSpacing(ctx, card.eyebrow * 0.22)
    ctx.fillText('E O GANHADOR É…', card.eyebrow * 0.11, y + (1 - e1) * 14 * q)
    setSpacing(ctx, 0)

    // nome: letras embaralhadas, entrada com mola e brilho dourado passando
    y += card.eyebrow / 2 + card.gap2 + nameLine / 2
    const np = clamp01((c - 0.3) / 0.8)
    const ns = lerp(0.5, 1, easeOutBack(np))
    const off = c > 1.2 ? (((c - 1.2) / 3) % 1) * nameWidth : 0
    ctx.save()
    ctx.translate(0, y)
    ctx.scale(ns, ns)
    ctx.globalAlpha = appear * clamp01(np / 0.4)
    ctx.font = `700 ${nameSize}px ${DISPLAY}`
    const shimmer = ctx.createLinearGradient(-nameWidth / 2 - off, 0, -nameWidth / 2 - off + 2 * nameWidth, 0)
    ;['#ffffff', '#ffd166', '#ffffff', '#ffd166', '#ffffff'].forEach((col, i) => shimmer.addColorStop(i / 4, col))
    ctx.fillStyle = shimmer
    ctx.shadowColor = 'rgba(255, 209, 102, 0.45)'
    ctx.shadowBlur = 26 * u
    ctx.shadowOffsetY = 5 * u
    ctx.fillText(scrambled(winnerLabel, clamp01((c - 0.3) / 1.0)), 0, 0)
    ctx.restore()

    // "Sorteado entre N nomes" e data
    const e2 = easeOutCubic(clamp01((c - 0.55) / 0.5))
    const lift = (1 - e2) * 14 * q
    y += nameLine / 2 + card.gap3 + card.meta / 2
    ctx.globalAlpha = appear * e2
    ctx.font = `500 ${card.meta}px ${BODY}`
    ctx.fillStyle = '#c9c3e6'
    ctx.fillText(`Sorteado entre ${countText}`, 0, y + lift)
    y += card.meta / 2 + card.gap4 + card.date / 2
    ctx.font = `500 ${card.date}px ${BODY}`
    ctx.fillStyle = '#9690bd'
    ctx.fillText(dateText, 0, y + lift)
    ctx.restore()
  }

  function drawConfetti(t) {
    const target = Math.floor((t - T.stop) / STEP)
    while (confettiTick <= target) {
      celebrationAt(confetti, confettiTick, rand)
      confetti.step()
      confettiTick++
    }
    confetti.draw(ctx)
  }

  function render(frame) {
    const t = frame / FPS
    const rot = rotationAt(draw.plan, t - T.spin)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.drawImage(bg, 0, 0)
    drawMotes(ctx, t, 1 / FPS, t >= T.spin && t < T.stop)
    drawHalo(t)
    drawRim(t)
    drawBulbs(t)
    drawFace(t, rot)
    drawPointer(t)
    ctx.drawImage(hub, cx - hub.width / 2, cy - hub.height / 2)
    drawTicker(t, rot)
    if (t >= T.card) drawCard(t - T.card)
    ctx.drawImage(credit, 0, L.credit.y - credit.height / 2)
    if (t >= T.stop) {
      drawConfetti(t)
      const fp = (t - T.stop) / 0.9
      if (fp < 1) {
        ctx.globalAlpha = 1 - easeOutCubic(fp)
        ctx.drawImage(flash, 0, 0)
        ctx.globalAlpha = 1
      }
    }
  }

  return {
    frames,
    duration: frames / FPS,
    render,
    soundtrack: {
      duration: frames / FPS,
      whooshAt: T.spin,
      ticks: ticks.map((x) => x + T.spin),
      fanfareAt: T.stop + 0.03,
    },
  }
}
