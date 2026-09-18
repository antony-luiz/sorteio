// Efeitos sonoros sintetizados com Web Audio (sem arquivos de áudio).
// Cada som é uma função (contexto, saída, instante), então os mesmos sons
// tocam ao vivo e também são gravados na trilha do vídeo do sorteio.

let ctx = null
let enabled = true

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function setEnabled(value) {
  enabled = value
}

/** Chamar dentro de um clique: navegadores só liberam áudio após interação. */
export function unlock() {
  if (enabled) audio()
}

function note(c, out, freq, at, dur, type = 'triangle', vol = 0.5) {
  const osc = c.createOscillator()
  const gain = c.createGain()
  const filter = c.createBiquadFilter()
  osc.type = type
  osc.frequency.setValueAtTime(freq, at)
  filter.type = 'lowpass'
  filter.frequency.value = 3200
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(vol, at + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(filter).connect(gain).connect(out)
  osc.start(at)
  osc.stop(at + dur + 0.05)
}

/** "Tec" do ponteiro batendo nos pinos da roleta. */
function playTick(c, out, t) {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(1900, t)
  osc.frequency.exponentialRampToValueAtTime(700, t + 0.03)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.22, t + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  osc.connect(gain).connect(out)
  osc.start(t)
  osc.stop(t + 0.06)
}

/** "Vush" ao dar o impulso na roleta. */
function playWhoosh(c, out, t) {
  const dur = 0.7
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const src = c.createBufferSource()
  src.buffer = buffer
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 1.4
  band.frequency.setValueAtTime(280, t)
  band.frequency.exponentialRampToValueAtTime(2400, t + dur)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.3, t + 0.08)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(band).connect(gain).connect(out)
  src.start(t)
}

/** Fanfarra de vitória: arpejo + acorde final com brilho. */
function playFanfare(c, out, t) {
  const master = c.createGain()
  master.gain.value = 0.28
  master.connect(out)

  const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5
  ;[C5, E5, G5, C6].forEach((f, i) => note(c, master, f, t + i * 0.12, 0.22, 'square', 0.3))
  ;[G5, C6].forEach((f, i) => note(c, master, f, t + 0.55 + i * 0.1, 0.18, 'square', 0.3))
  ;[C5, E5, G5, C6].forEach((f) => note(c, master, f, t + 0.8, 1.4, 'sawtooth', 0.16))
  ;[2093, 2637, 3136].forEach((f, i) => note(c, master, f, t + 0.85 + i * 0.07, 0.6, 'sine', 0.12))
}

const live = (play, delay = 0) => () => {
  if (!enabled) return
  const c = audio()
  if (c) play(c, c.destination, c.currentTime + delay)
}

export const tick = live(playTick)
export const whoosh = live(playWhoosh)
export const fanfare = live(playFanfare, 0.03)

/**
 * Trilha do vídeo: renderiza os mesmos sons fora de tempo real.
 * Tempos em segundos a partir do início do vídeo. Resolve com um AudioBuffer (ou null).
 */
export async function renderSoundtrack({ duration, whooshAt, ticks, fanfareAt, sampleRate = 48000 }) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!OAC) return null
  const c = new OAC(2, Math.ceil(duration * sampleRate), sampleRate)
  const out = c.destination
  playWhoosh(c, out, whooshAt)
  for (const t of ticks) playTick(c, out, t)
  playFanfare(c, out, fanfareAt)
  const buffer = await c.startRendering()

  // normaliza: os sons ao vivo são discretos; no vídeo o pico fica perto de -2 dB
  let peak = 0
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    for (const v of buffer.getChannelData(ch)) peak = Math.max(peak, Math.abs(v))
  }
  const gain = peak > 0 ? Math.min(3, 0.8 / peak) : 1
  if (gain !== 1) {
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < data.length; i++) data[i] *= gain
    }
  }
  return buffer
}
