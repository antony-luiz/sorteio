// Painel "Vídeo do sorteio" no modal do ganhador: escolher o formato, acompanhar
// o progresso e baixar/compartilhar o MP4. O gerador (e a biblioteca de vídeo)
// só é carregado quando alguém pede um vídeo.
import { toast } from './effects.js'

const MESSAGES = {
  unsupported: 'Este navegador não consegue gerar vídeo. Use o Chrome, o Edge ou o Safari atualizado.',
  failed: 'Não foi possível gerar o vídeo. Tente de novo.',
}
const supported = typeof VideoEncoder !== 'undefined'

function slug(text) {
  const s = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return s || 'ganhador'
}

function fileName(draw, format) {
  const d = new Date(draw.at)
  const p = (x) => String(x).padStart(2, '0')
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
  return `sorteio-${slug(draw.winner)}-${stamp}${format === 'square' ? '-quadrado' : ''}.mp4`
}

function canShare(file) {
  try {
    return !!navigator.canShare?.({ files: [file] })
  } catch {
    return false
  }
}

export function createVideoPanel({ root, onChange }) {
  const $ = (sel) => root.querySelector(sel)
  const el = {
    hint: $('#videoHint'),
    formats: root.querySelectorAll('.format-btn'),
    progress: $('#videoProgress'),
    bar: $('.progress__bar'),
    status: $('#videoStatus'),
    preview: $('#videoPreview'),
    info: $('#videoInfo'),
    share: $('#videoShare'),
    error: $('#videoError'),
  }
  let draw = null
  let job = null // { format, status, progress, controller, result, file, url, error }

  if (!supported) {
    el.hint.textContent = MESSAGES.unsupported
    el.formats.forEach((b) => (b.disabled = true))
  }

  function update() {
    const status = job?.status || 'idle'
    root.dataset.state = status
    if (status === 'rendering') {
      const pct = Math.round(job.progress * 100)
      el.bar.style.transform = `scaleX(${job.progress})`
      el.progress.setAttribute('aria-valuenow', String(pct))
      el.status.textContent = pct < 100 ? `Gerando vídeo… ${pct}%` : 'Finalizando o arquivo…'
    } else if (status === 'done') {
      root.dataset.result = job.format
      if (el.preview.getAttribute('src') !== job.url) el.preview.src = job.url
      if (!root.closest('[hidden]')) el.preview.play?.().catch(() => {})
      const { blob, duration, audioCodec, videoCodec } = job.result
      const mb = (blob.size / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
      let info = `MP4 · ${Math.round(duration)} s · ${mb} MB`
      if (!audioCodec) info += ' · sem som'
      if (videoCodec !== 'avc') info += ' · pode não abrir em alguns apps'
      el.info.textContent = info
      el.share.hidden = !canShare(job.file)
    } else if (status === 'error') {
      el.error.textContent = job.error
    }
    onChange?.(status, job?.progress ?? 0)
  }

  function discard() {
    if (!job) return
    job.controller?.abort()
    if (job.url) URL.revokeObjectURL(job.url)
    el.preview.pause()
    el.preview.removeAttribute('src')
    el.preview.load()
    job = null
  }

  async function start(format) {
    if (!draw || !supported || job?.status === 'rendering') return
    discard()
    const controller = new AbortController()
    const current = { format, status: 'rendering', progress: 0, controller }
    job = current
    update()
    try {
      const { exportDrawVideo } = await import('./video/export.js')
      const result = await exportDrawVideo(draw, {
        format,
        signal: controller.signal,
        onProgress: (p) => {
          if (job !== current) return
          current.progress = p
          update()
        },
      })
      if (job !== current) return
      current.result = result
      current.file = new File([result.blob], fileName(draw, format), { type: 'video/mp4' })
      current.url = URL.createObjectURL(result.blob)
      current.status = 'done'
      update()
      if (root.closest('[hidden]')) toast('Vídeo do sorteio pronto 🎬')
    } catch (err) {
      if (job !== current) return
      if (err?.code === 'aborted') {
        job = null
      } else {
        console.error('Erro ao gerar o vídeo', err)
        current.status = 'error'
        current.error = MESSAGES[err?.code] || MESSAGES.failed
      }
      update()
    }
  }

  function download() {
    const a = document.createElement('a')
    a.href = job.url
    a.download = job.file.name
    document.body.append(a)
    a.click()
    a.remove()
    toast('Download do vídeo iniciado ⬇️')
  }

  async function share() {
    try {
      await navigator.share({
        files: [job.file],
        title: 'Resultado do sorteio',
        text: `🏆 ${draw.winner} — Roleta da Sorte`,
      })
    } catch (err) {
      if (err?.name !== 'AbortError') toast('Não deu para compartilhar. Use “Baixar MP4”.')
    }
  }

  root.addEventListener('click', (e) => {
    const format = e.target.closest('.format-btn')?.dataset.format
    if (format) return start(format)
    const action = e.target.closest('[data-video]')?.dataset.video
    if (action === 'cancel' || action === 'again') {
      discard()
      update()
    } else if (action === 'retry') start(job?.format || 'vertical')
    else if (action === 'download' && job?.url) download()
    else if (action === 'share' && job?.file) share()
  })

  return {
    /** Troca o sorteio de referência; um vídeo de outro sorteio é descartado. */
    setDraw(next) {
      if (next === draw) return
      discard()
      draw = next
      update()
    },
    refresh: update,
    pausePreview: () => el.preview.pause(),
    get status() {
      return job?.status || 'idle'
    },
    get progress() {
      return job?.progress ?? 0
    },
  }
}
