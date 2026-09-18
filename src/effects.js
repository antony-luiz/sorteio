// Efeitos visuais: confete, partículas de fundo, ripple, toasts, texto embaralhado.
import confetti from 'canvas-confetti'

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const COLORS = ['#ff4d8d', '#ffd166', '#06d6a0', '#3a86ff', '#8338ec', '#ff7b00', '#ffffff']
const base = { colors: COLORS, zIndex: 1200, disableForReducedMotion: true }

/** Chuva de confete + canhões laterais + fogos. */
export function celebrate() {
  confetti({ ...base, particleCount: 150, spread: 95, startVelocity: 52, origin: { y: 0.62 }, scalar: 1.1 })
  confetti({ ...base, particleCount: 50, spread: 130, startVelocity: 40, origin: { y: 0.62 }, shapes: ['star'], scalar: 1.5 })

  const end = performance.now() + 2600
  ;(function cannons() {
    confetti({ ...base, particleCount: 3, angle: 60, spread: 60, startVelocity: 58, origin: { x: 0, y: 0.8 } })
    confetti({ ...base, particleCount: 3, angle: 120, spread: 60, startVelocity: 58, origin: { x: 1, y: 0.8 } })
    if (performance.now() < end) requestAnimationFrame(cannons)
  })()

  let bursts = 0
  const timer = setInterval(() => {
    confetti({
      ...base,
      particleCount: 45,
      spread: 360,
      startVelocity: 26,
      gravity: 0.7,
      ticks: 90,
      decay: 0.92,
      shapes: ['star', 'circle'],
      origin: { x: 0.15 + Math.random() * 0.7, y: 0.12 + Math.random() * 0.3 },
    })
    if (++bursts >= 7) clearInterval(timer)
  }, 420)
}

/** Clarão rápido na tela no momento da vitória. */
export function flash() {
  if (reducedMotion()) return
  const el = document.createElement('div')
  el.className = 'screen-flash'
  el.addEventListener('animationend', () => el.remove())
  document.body.append(el)
}

/** Reinicia uma animação CSS de classe (ex.: "bump"). */
export function replay(el, cls) {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}

/** Revela o texto com letras embaralhadas, estilo "caça-níquel". */
export function scrambleText(el, text, duration = 1000) {
  cancelAnimationFrame(el._scramble)
  const chars = Array.from(text)
  if (reducedMotion()) {
    el.textContent = text
    return
  }
  const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÇ0123456789★'
  const start = performance.now()
  const step = (now) => {
    const p = Math.min(1, (now - start) / duration)
    const shown = Math.floor(p * chars.length)
    el.textContent = chars
      .map((ch, i) => (i < shown || ch === ' ' ? ch : pool[Math.floor(Math.random() * pool.length)]))
      .join('')
    if (p < 1) el._scramble = requestAnimationFrame(step)
    else el.textContent = text
  }
  el._scramble = requestAnimationFrame(step)
}

/** Ondinha (ripple) em botões, abas e ícones. */
export function enableRipples() {
  document.addEventListener('pointerdown', (e) => {
    const target = e.target.closest('.btn, .tab, .icon-btn, .wheel__hub')
    if (!target || target.disabled) return
    const rect = target.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2
    const ripple = document.createElement('span')
    ripple.className = 'ripple'
    ripple.style.width = ripple.style.height = `${size}px`
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`
    ripple.addEventListener('animationend', () => ripple.remove())
    target.append(ripple)
  })
}

/** Mensagem flutuante; aceita um botão de ação (ex.: "Desfazer"). */
export function toast(message, { action, onAction, duration = 3000 } = {}) {
  const wrap = document.getElementById('toasts')
  const el = document.createElement('div')
  el.className = 'toast'
  el.setAttribute('role', 'status')
  const text = document.createElement('span')
  text.textContent = message
  el.append(text)

  let timer
  const dismiss = () => {
    clearTimeout(timer)
    if (el.classList.contains('is-leaving')) return
    el.classList.add('is-leaving')
    setTimeout(() => el.remove(), 320)
  }

  if (action) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'toast__action'
    btn.textContent = action
    btn.addEventListener('click', () => {
      onAction?.()
      dismiss()
    })
    el.append(btn)
    duration = Math.max(duration, 5500)
  }

  wrap.append(el)
  while (wrap.children.length > 3) wrap.firstElementChild.remove()
  timer = setTimeout(dismiss, duration)
}

/** Partículas brilhantes subindo no fundo; aceleram enquanto a roleta gira. */
export function createParticles(canvas) {
  const noop = { setBoost() {} }
  if (reducedMotion()) return noop
  const ctx = canvas.getContext('2d')
  if (!ctx) return noop

  const HUES = [340, 45, 160, 205, 265]
  const parts = []
  let w = 0, h = 0, raf = 0, last = performance.now()
  let boost = 0, boostTarget = 0

  const make = (anywhere) => ({
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : h + 10,
    r: 0.8 + Math.random() * 2.2,
    vy: 8 + Math.random() * 22,
    vx: (Math.random() - 0.5) * 10,
    ph: Math.random() * Math.PI * 2,
    hue: HUES[Math.floor(Math.random() * HUES.length)],
  })

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = window.innerWidth
    h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const target = Math.round(Math.min(70, (w * h) / 20000))
    while (parts.length < target) parts.push(make(true))
    parts.length = target
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    boost += (boostTarget - boost) * Math.min(1, dt * 2.5)
    ctx.clearRect(0, 0, w, h)
    const speed = 1 + boost * 6
    for (const p of parts) {
      p.y -= p.vy * dt * speed
      p.x += (p.vx + Math.sin(now / 1000 + p.ph) * 8) * dt * (1 + boost * 2)
      if (p.y < -12 || p.x < -12 || p.x > w + 12) Object.assign(p, make(false))
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(now / 600 + p.ph))
      const r = p.r * (1 + boost * 0.7)
      ctx.fillStyle = `hsla(${p.hue}, 95%, 70%, ${a * 0.16})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `hsla(${p.hue}, 95%, 78%, ${a})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    raf = requestAnimationFrame(frame)
  }

  resize()
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf)
    if (!document.hidden) {
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
  })
  raf = requestAnimationFrame(frame)

  return {
    setBoost(on) {
      boostTarget = on ? 1 : 0
    },
  }
}
