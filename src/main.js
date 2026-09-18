import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/wheel.css'
import './styles/modal.css'
import './styles/video.css'

import { Wheel } from './wheel.js'
import { createRouter, ROUTES } from './router.js'
import * as sound from './sound.js'
import { loadState, saveState, parseNames, randomInt, shuffle, dedupe, SAMPLE_NAMES } from './store.js'
import {
  celebrate, flash, replay, scrambleText, enableRipples, toast, createParticles, reducedMotion,
} from './effects.js'
import { createVideoPanel } from './video-ui.js'

const $ = (sel) => document.querySelector(sel)
const els = {
  screens: $('#screens'),
  tabbar: $('#tabbar'),
  input: $('#namesInput'),
  count: $('#nameCount'),
  autoRemove: $('#autoRemove'),
  wheel: $('#wheel'),
  rim: $('#wheelRim'),
  canvas: $('#wheelCanvas'),
  pointer: $('#pointer'),
  ticker: $('#ticker'),
  spinBtn: $('#spinBtn'),
  wheelMsg: $('#wheelMsg'),
  history: $('#history'),
  historyEmpty: $('#historyEmpty'),
  clearHistory: $('#clearHistory'),
  badge: $('#historyBadge'),
  modal: $('#winnerModal'),
  winnerName: $('#winnerName'),
  winnerMeta: $('#winnerMeta'),
  removeWinner: $('#removeWinner'),
  spinAgain: $('#spinAgain'),
  soundToggle: $('#soundToggle'),
  live: $('#live'),
  videoBox: $('#videoBox'),
  videoLink: $('#videoLink'),
  videoLinkText: $('#videoLinkText'),
}

const state = loadState()
let names = parseNames(state.text)
let spinning = false
let announcing = false // entre a parada da roleta e a abertura do modal
let lastDraw = null // último sorteio: { names, index, winner, plan, at } — base do vídeo
let modalDraw = null // sorteio mostrado no modal
let modalReview = false // modal reaberto pelo link do vídeo (sem festa, não tira da lista ao fechar)
let modalTimer = 0
let lastTickAt = 0

const video = createVideoPanel({ root: els.videoBox, onChange: updateVideoLink })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// ---------- Roleta ----------
const wheel = new Wheel(els.canvas, { onTick })
const particles = createParticles($('#particles'))

function buildBulbs(count = 24) {
  for (let k = 0; k < count; k++) {
    const bulb = document.createElement('i')
    bulb.className = 'bulb'
    bulb.style.setProperty('--a', `${(360 / count) * k}deg`)
    bulb.style.setProperty('--d', `${(-k * 0.06).toFixed(2)}s`)
    els.rim.append(bulb)
  }
}

function onTick(_index, name) {
  if (!spinning) return
  els.ticker.textContent = name
  const now = performance.now()
  if (now - lastTickAt < 40) return
  lastTickAt = now
  sound.tick()
  els.pointer.animate([{ transform: 'rotate(-24deg)' }, { transform: 'rotate(0deg)' }], {
    duration: 170,
    easing: 'cubic-bezier(.2,.8,.3,1)',
  })
}

function idleTicker() {
  els.ticker.classList.remove('is-winner')
  els.ticker.textContent = names.length >= 2 ? 'Clique em GIRAR para sortear' : 'Adicione pelo menos 2 nomes'
}

// ---------- Lista de nomes ----------
function setNames(list, { fromInput = false } = {}) {
  // a lista não muda no meio do giro (ex.: "Desfazer" de um toast antigo)
  if (spinning) return toast('Espere a roleta parar ⏳')
  names = list
  if (!fromInput) els.input.value = names.join('\n')
  state.text = els.input.value
  saveState(state)

  els.count.textContent = plural(names.length, 'nome', 'nomes')
  replay(els.count, 'bump')
  wheel.setNames(names)
  els.wheel.classList.remove('is-winner')
  els.wheel.classList.toggle('is-empty', names.length < 2)
  els.wheelMsg.hidden = names.length >= 2
  if (!spinning) idleTicker()
}

let inputTimer
els.input.addEventListener('input', () => {
  clearTimeout(inputTimer)
  inputTimer = setTimeout(() => setNames(parseNames(els.input.value), { fromInput: true }), 180)
})
els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    if (spinning) return
    clearTimeout(inputTimer)
    setNames(parseNames(els.input.value), { fromInput: true })
    spin()
  }
})
// No celular, esconde a barra de abas enquanto o teclado está aberto
els.input.addEventListener('focus', () => document.body.classList.add('typing'))
els.input.addEventListener('blur', () => document.body.classList.remove('typing'))

$('.toolbar').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]')
  if (!btn || spinning) return
  const action = btn.dataset.action

  if (action === 'shuffle') {
    if (names.length < 2) return toast('Adicione nomes para embaralhar')
    setNames(shuffle(names))
    replay(els.wheel, 'is-shuffled')
    toast('Lista embaralhada 🔀')
  } else if (action === 'dedupe') {
    const unique = dedupe(names)
    const removed = names.length - unique.length
    setNames(unique)
    toast(removed ? `${plural(removed, 'repetido removido', 'repetidos removidos')}` : 'Nenhum nome repetido 👍')
  } else if (action === 'sample') {
    setNames(SAMPLE_NAMES.slice())
    toast('Lista de exemplo carregada ✨')
  } else if (action === 'clear') {
    if (!names.length) return
    const backup = els.input.value
    setNames([])
    toast('Lista apagada', {
      action: 'Desfazer',
      onAction: () => {
        els.input.value = backup
        setNames(parseNames(backup), { fromInput: true })
      },
    })
  }
})

els.autoRemove.addEventListener('change', () => {
  state.autoRemove = els.autoRemove.checked
  saveState(state)
})

// ---------- Sorteio ----------
function setBusy(busy) {
  document.querySelectorAll('[data-busy-disable]').forEach((el) => (el.disabled = busy))
  els.input.readOnly = busy
  document.body.classList.toggle('is-spinning', busy)
}

async function spin() {
  if (spinning || announcing || !els.modal.hidden) return
  // aplica o que acabou de ser digitado (o campo tem um pequeno atraso)
  clearTimeout(inputTimer)
  const typed = parseNames(els.input.value)
  if (typed.join('\n') !== names.join('\n')) setNames(typed, { fromInput: true })
  if (names.length < 2) {
    toast('Adicione pelo menos 2 nomes para sortear ✍️')
    if (router.isMobile()) router.go('nomes')
    setTimeout(() => els.input.focus(), 400)
    return
  }
  if (router.isMobile() && router.route !== 'roleta') {
    router.go('roleta')
    await wait(450)
  }

  spinning = true
  setBusy(true)
  lastDraw = null
  video.setDraw(null) // um novo sorteio descarta o vídeo do anterior
  updateVideoLink()
  els.ticker.classList.remove('is-winner')
  sound.unlock()
  sound.whoosh()
  particles.setBoost(true)

  const pool = names.slice()
  const index = randomInt(pool.length) // sorteio justo; a animação só "leva" até ele
  const duration = reducedMotion() ? 2200 : 5200 + randomInt(1600)
  const stopped = wheel.spin(index, duration)
  // guarda o giro exato: o vídeo repete o mesmo movimento, quadro a quadro
  const draw = { names: pool, index, winner: pool[index], plan: wheel.lastPlan, at: Date.now() }
  await stopped

  particles.setBoost(false)
  spinning = false
  setBusy(false)
  announceWinner(draw)
}

function announceWinner(draw) {
  const { winner: name, index } = draw
  draw.at = Date.now()
  lastDraw = draw
  announcing = true
  video.setDraw(draw)
  wheel.setHighlight(index)
  els.wheel.classList.add('is-winner')
  els.ticker.textContent = `🏆 ${name}`
  replay(els.ticker, 'is-winner')
  els.live.textContent = `Ganhador: ${name}`

  state.history.push({ name, at: draw.at, total: draw.names.length })
  saveState(state)
  renderHistory(true)

  sound.fanfare()
  flash()
  celebrate()
  if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([70, 50, 140])
  setTimeout(() => {
    announcing = false
    openModal(draw)
  }, 500)
}

// ---------- Modal do ganhador ----------
function openModal(draw, { review = false } = {}) {
  clearTimeout(modalTimer)
  modalDraw = draw
  modalReview = review
  const total = draw.names.length
  els.modal.style.setProperty('--winner-color', wheel.colorAt(draw.index, total))
  els.winnerMeta.textContent = `Sorteado entre ${plural(total, 'nome', 'nomes')}`
  els.removeWinner.hidden = review ? !names.includes(draw.winner) : state.autoRemove
  els.winnerName.textContent = ''
  els.modal.hidden = false
  void els.modal.offsetWidth // força o layout para a transição de entrada rodar
  els.modal.classList.add('is-open')
  scrambleText(els.winnerName, draw.winner, 1000)
  video.refresh()
  updateVideoLink()
  els.spinAgain.focus({ preventScroll: true })
}

function closeModal({ remove = !modalReview && state.autoRemove } = {}) {
  if (!modalDraw) return
  els.modal.classList.remove('is-open')
  clearTimeout(modalTimer)
  modalTimer = setTimeout(() => {
    els.modal.hidden = true
    updateVideoLink()
  }, 380)
  video.pausePreview()
  if (remove) removeName(modalDraw)
  modalDraw = null
}

function removeName({ winner, index }) {
  const i = names[index] === winner ? index : names.indexOf(winner)
  if (i < 0) return
  setNames(names.filter((_, k) => k !== i))
  toast(`“${winner}” saiu da lista`)
}

// Link na roleta para voltar ao vídeo do último sorteio (mostra o progresso)
function updateVideoLink(status = video.status, progress = video.progress) {
  els.videoLink.hidden = !lastDraw || spinning || announcing || !els.modal.hidden
  els.videoLink.dataset.state = status
  els.videoLinkText.textContent =
    status === 'rendering'
      ? `Gerando vídeo… ${Math.round(progress * 100)}%`
      : status === 'done'
        ? 'Vídeo do sorteio pronto — baixar'
        : 'Vídeo do último sorteio'
}

els.videoLink.addEventListener('click', () => {
  if (lastDraw && !spinning) openModal(lastDraw, { review: true })
})

els.modal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) closeModal()
})
els.removeWinner.addEventListener('click', () => closeModal({ remove: true }))
els.spinAgain.addEventListener('click', async () => {
  closeModal()
  await wait(420)
  spin()
})
els.modal.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return closeModal()
  if (e.key !== 'Tab') return
  const focusable = [...els.modal.querySelectorAll('button, a[href]')].filter(
    (el) => !el.disabled && el.getClientRects().length > 0,
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
})

// ---------- Histórico ----------
const formatTime = (ts) =>
  new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function renderHistory(animateNewest = false) {
  const list = state.history.slice().reverse()
  els.history.replaceChildren(
    ...list.map((item, i) => {
      const li = document.createElement('li')
      li.className = 'history__item' + (animateNewest && i === 0 ? ' is-new' : '')
      const pos = document.createElement('span')
      pos.className = 'history__pos'
      pos.textContent = list.length - i
      const name = document.createElement('span')
      name.className = 'history__name'
      name.textContent = item.name
      name.title = item.name
      const time = document.createElement('time')
      time.className = 'history__time'
      time.dateTime = new Date(item.at).toISOString()
      time.textContent = formatTime(item.at)
      li.append(pos, name, time)
      return li
    }),
  )
  els.historyEmpty.hidden = list.length > 0
  els.clearHistory.hidden = list.length === 0
  els.badge.textContent = list.length ? String(Math.min(list.length, 99)) : ''
  if (animateNewest) replay(els.badge, 'bump')
}

els.clearHistory.addEventListener('click', () => {
  const backup = state.history.slice()
  state.history = []
  saveState(state)
  renderHistory()
  toast('Histórico apagado', {
    action: 'Desfazer',
    onAction: () => {
      state.history = backup
      saveState(state)
      renderHistory()
    },
  })
})

// ---------- Som ----------
function renderSound() {
  sound.setEnabled(state.sound)
  els.soundToggle.setAttribute('aria-pressed', String(state.sound))
  els.soundToggle.setAttribute('aria-label', state.sound ? 'Desativar som' : 'Ativar som')
}

els.soundToggle.addEventListener('click', () => {
  state.sound = !state.sound
  saveState(state)
  renderSound()
  if (state.sound) {
    sound.unlock()
    sound.tick()
  }
  toast(state.sound ? 'Som ligado 🔊' : 'Som desligado 🔇')
})

// ---------- Telas (celular) ----------
function showRoute(route, previous) {
  const i = ROUTES.indexOf(route)
  els.screens.dataset.dir = previous && i < ROUTES.indexOf(previous) ? 'back' : 'fwd'
  document.querySelectorAll('[data-screen]').forEach((s) => s.classList.toggle('is-active', s.dataset.screen === route))
  document.querySelectorAll('[data-tab]').forEach((tab) => {
    const active = tab.dataset.tab === route
    tab.classList.toggle('is-active', active)
    if (active) tab.setAttribute('aria-current', 'page')
    else tab.removeAttribute('aria-current')
  })
  els.tabbar.style.setProperty('--i', i)
  if (!els.modal.hidden && previous && previous !== route) closeModal()
}

const router = createRouter({
  onChange: showRoute,
  fallback: () => (names.length >= 2 ? 'roleta' : 'nomes'),
})

document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-go]')
  if (!link) return
  const route = link.dataset.go
  if (route === 'roleta' && names.length < 2) {
    toast('Adicione pelo menos 2 nomes ✍️')
    return els.input.focus()
  }
  if (route === 'nomes' && !router.isMobile()) return els.input.focus()
  router.go(route)
})

// Clique em qualquer parte da roleta (ou no botão GIRAR) gira
els.wheel.addEventListener('click', spin)
els.spinBtn.addEventListener('click', spin)
// Barra de espaço gira quando nada está focado (bom para telão/apresentação)
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target === document.body) {
    e.preventDefault()
    spin()
  }
})

// ---------- Início ----------
buildBulbs()
enableRipples()
els.autoRemove.checked = !!state.autoRemove
els.input.value = state.text
setNames(names, { fromInput: true })
renderHistory()
renderSound()
router.start()
document.fonts?.ready.then(() => wheel.draw())
