// Estado salvo no navegador + utilitários de lista/aleatoriedade.

const KEY = 'roleta-da-sorte:v1'
const MAX_HISTORY = 100

const defaults = () => ({ text: '', autoRemove: false, sound: true, history: [] })

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
    const history = Array.isArray(saved.history)
      ? saved.history.filter((h) => h && typeof h.name === 'string')
      : []
    return { ...defaults(), ...saved, history }
  } catch {
    return defaults()
  }
}

export function saveState(state) {
  if (state.history.length > MAX_HISTORY) state.history.splice(0, state.history.length - MAX_HISTORY)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // armazenamento cheio ou bloqueado (aba anônima): o app segue funcionando sem salvar
  }
}

/** Um nome por linha; vírgula e ponto e vírgula também separam. */
export function parseNames(text = '') {
  return String(text)
    .split(/[\n\r,;]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Inteiro uniforme em [0, max) usando crypto (sem viés de módulo). */
export function randomInt(max) {
  const c = globalThis.crypto
  if (!c?.getRandomValues) return Math.floor(Math.random() * max)
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  do c.getRandomValues(buf)
  while (buf[0] >= limit)
  return buf[0] % max
}

/** Fisher–Yates. */
export function shuffle(list) {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Remove repetidos ignorando maiúsculas/minúsculas; mantém a 1ª ocorrência. */
export function dedupe(list) {
  const seen = new Set()
  return list.filter((name) => {
    const key = name.toLocaleLowerCase('pt-BR')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const SAMPLE_NAMES = [
  'Ana Clara', 'Bruno', 'Camila', 'Diego', 'Eduarda', 'Felipe',
  'Gabriela', 'Heitor', 'Isabela', 'João Pedro', 'Larissa', 'Matheus',
]
