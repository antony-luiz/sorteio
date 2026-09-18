// Gera o MP4 do sorteio no próprio navegador (WebCodecs + mediabunny):
// desenha cada quadro da cena, codifica em H.264 e junta a trilha sonora em AAC.
import {
  Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, Quality,
  canEncodeVideo, canEncodeAudio,
} from 'mediabunny'
import { createScene, FORMATS, FPS } from './scene.js'
import { renderSoundtrack } from '../sound.js'

export class VideoError extends Error {
  constructor(code, message) {
    super(message || code)
    this.code = code
  }
}

// H.264 High (automático), Main e Baseline: alguns aparelhos só têm o Baseline.
const AVC_PROFILES = [undefined, 'avc1.4D0028', 'avc1.42E028']
const AUDIO = { numberOfChannels: 2, sampleRate: 48000 }

const videoQuality = (w, h) => new Quality({ bitrate: Math.round(w * h * FPS * 0.11) })
const audioQuality = new Quality({ bitrate: 128000 })

async function pickVideoCodec(width, height) {
  const base = { width, height, frameRate: FPS, quality: videoQuality(width, height) }
  for (const fullCodecString of AVC_PROFILES) {
    if (await canEncodeVideo('avc', { ...base, ...(fullCodecString && { fullCodecString }) })) {
      return { codec: 'avc', fullCodecString }
    }
  }
  // sem H.264: ainda dá MP4, mas alguns apps podem não abrir
  for (const codec of ['hevc', 'vp9', 'av1']) {
    if (await canEncodeVideo(codec, base)) return { codec }
  }
  return null
}

let aacPolyfill = null
async function pickAudioCodec() {
  const opts = { ...AUDIO, quality: audioQuality }
  if (await canEncodeAudio('aac', opts)) return 'aac'
  // navegador sem AAC nativo: carrega um codificador AAC em WebAssembly
  try {
    aacPolyfill ??= import('@mediabunny/aac-encoder').then((m) => m.registerAacEncoder())
    await aacPolyfill
    if (await canEncodeAudio('aac', opts)) return 'aac'
  } catch (err) {
    console.warn('Codificador AAC indisponível', err)
  }
  if (await canEncodeAudio('opus', opts)) return 'opus'
  return null
}

// Pausa curta para a tela atualizar o progresso. MessageChannel não sofre a
// desaceleração que setTimeout tem quando a aba fica em segundo plano.
const channel = typeof MessageChannel === 'function' ? new MessageChannel() : null
function yieldToUI() {
  if (globalThis.scheduler?.yield) return globalThis.scheduler.yield()
  if (!channel) return new Promise((r) => setTimeout(r, 0))
  return new Promise((r) => {
    channel.port1.onmessage = () => r()
    channel.port2.postMessage(0)
  })
}

/**
 * @param draw   { names, index, winner, plan, at } — o sorteio a reproduzir
 * @param format 'vertical' (1080×1920) ou 'square' (1080×1080)
 * @returns { blob, width, height, duration, videoCodec, audioCodec, mimeType }
 */
export async function exportDrawVideo(draw, { format = 'vertical', onProgress = () => {}, signal } = {}) {
  if (typeof VideoEncoder === 'undefined') throw new VideoError('unsupported')

  let { width, height } = FORMATS[format] || FORMATS.vertical
  let video = await pickVideoCodec(width, height)
  if (!video) {
    // aparelho mais fraco: tenta em 720p
    width = Math.round((width * 2) / 3 / 2) * 2
    height = Math.round((height * 2) / 3 / 2) * 2
    video = await pickVideoCodec(width, height)
  }
  if (!video) throw new VideoError('unsupported')
  if (signal?.aborted) throw new VideoError('aborted')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const scene = await createScene(canvas, draw)
  const audioCodec = await pickAudioCodec()

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  })
  const videoSource = new CanvasSource(canvas, {
    codec: video.codec,
    ...(video.fullCodecString && { fullCodecString: video.fullCodecString }),
    quality: videoQuality(width, height),
    keyFrameInterval: 2,
  })
  output.addVideoTrack(videoSource, { frameRate: FPS })
  let audioSource = null
  if (audioCodec) {
    audioSource = new AudioBufferSource({ codec: audioCodec, quality: audioQuality })
    output.addAudioTrack(audioSource)
  }
  output.setMetadataTags({
    title: `Sorteio — ${draw.winner}`,
    artist: 'Roleta da Sorte · by Antony Luiz dev',
    comment: 'Gerado em antonyluiz.dev',
    date: new Date(draw.at),
  })

  try {
    await output.start()
    if (audioSource) {
      const buffer = await renderSoundtrack(scene.soundtrack)
      if (buffer) await audioSource.add(buffer)
      audioSource.close()
    }
    for (let f = 0; f < scene.frames; f++) {
      if (signal?.aborted) throw new VideoError('aborted')
      scene.render(f)
      await videoSource.add(f / FPS, 1 / FPS)
      if (f % 3 === 2) {
        onProgress((f + 1) / scene.frames)
        await yieldToUI()
      }
    }
    videoSource.close()
    onProgress(1)
    await output.finalize()
  } catch (err) {
    if (output.state === 'pending' || output.state === 'started') await output.cancel().catch(() => {})
    throw err
  }

  const mimeType = await output.getMimeType().catch(() => 'video/mp4')
  return {
    blob: new Blob([output.target.buffer], { type: 'video/mp4' }),
    width,
    height,
    duration: scene.duration,
    videoCodec: video.codec,
    audioCodec,
    mimeType,
  }
}
