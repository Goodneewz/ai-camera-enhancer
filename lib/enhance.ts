// Client-side image enhancement engine.
// Pipeline: HD upscale -> auto levels (contrast stretch) -> shadow lift ->
// saturation boost -> unsharp-mask sharpening.

export interface Adjustments {
  brightness: number // -100..100
  contrast: number // -100..100
  saturation: number // -100..100
  shadows: number // 0..100 (shadow removal / lift)
  sharpness: number // 0..100
  enhance: number // 0..100 overall AI enhance strength
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  shadows: 0,
  sharpness: 0,
  enhance: 0,
}

export const AUTO_ENHANCE: Adjustments = {
  brightness: 6,
  contrast: 14,
  saturation: 16,
  shadows: 30,
  sharpness: 55,
  enhance: 100,
}

const HD_TARGET_WIDTH = 1920
const MAX_WIDTH = 2560

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Upscale a source image/canvas to HD resolution with high-quality smoothing. */
export function upscaleToHD(
  source: HTMLImageElement | HTMLCanvasElement,
  targetWidth = HD_TARGET_WIDTH,
): HTMLCanvasElement {
  const srcW = source.width
  const srcH = source.height
  let outW = srcW
  let outH = srcH

  if (srcW < targetWidth) {
    const scale = Math.min(targetWidth / srcW, MAX_WIDTH / srcW, 3)
    outW = Math.round(srcW * scale)
    outH = Math.round(srcH * scale)
  }

  // Two-step upscale produces smoother results than a single jump
  const mid = document.createElement('canvas')
  const midScale = Math.sqrt(outW / srcW)
  mid.width = Math.round(srcW * midScale)
  mid.height = Math.round(srcH * midScale)
  const midCtx = mid.getContext('2d')!
  midCtx.imageSmoothingEnabled = true
  midCtx.imageSmoothingQuality = 'high'
  midCtx.drawImage(source, 0, 0, mid.width, mid.height)

  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(mid, 0, 0, outW, outH)
  return out
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

/** Auto contrast stretch based on histogram percentiles (part of AI enhance). */
function autoLevels(data: Uint8ClampedArray, strength: number) {
  if (strength <= 0) return
  const hist = new Array(256).fill(0)
  const total = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    )
    hist[lum]++
  }
  let lo = 0
  let hi = 255
  let acc = 0
  const cut = total * 0.005
  for (let i = 0; i < 256; i++) {
    acc += hist[i]
    if (acc > cut) {
      lo = i
      break
    }
  }
  acc = 0
  for (let i = 255; i >= 0; i--) {
    acc += hist[i]
    if (acc > cut) {
      hi = i
      break
    }
  }
  if (hi - lo < 20) return
  const scale = 255 / (hi - lo)
  const s = strength // 0..1 blend
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const stretched = clamp((data[i + c] - lo) * scale)
      data[i + c] = clamp(data[i + c] * (1 - s) + stretched * s)
    }
  }
}

/** Apply brightness / contrast / saturation / shadow lift in one pass. */
function applyTone(data: Uint8ClampedArray, adj: Adjustments) {
  const b = (adj.brightness / 100) * 60
  const c = adj.contrast / 100
  const cFactor = (259 * (c * 128 + 255)) / (255 * (259 - c * 128))
  const sat = 1 + adj.saturation / 100
  const shadow = adj.shadows / 100

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let bl = data[i + 2]

    // Shadow lift: boost dark pixels with a soft tone curve (shadow removal)
    if (shadow > 0) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * bl
      const darkness = Math.pow(1 - lum / 255, 2)
      const lift = shadow * darkness * 90
      r += lift
      g += lift
      bl += lift
    }

    // Brightness
    r += b
    g += b
    bl += b

    // Contrast
    r = cFactor * (r - 128) + 128
    g = cFactor * (g - 128) + 128
    bl = cFactor * (bl - 128) + 128

    // Saturation
    if (sat !== 1) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * bl
      r = gray + (r - gray) * sat
      g = gray + (g - gray) * sat
      bl = gray + (bl - gray) * sat
    }

    data[i] = clamp(r)
    data[i + 1] = clamp(g)
    data[i + 2] = clamp(bl)
  }
}

/** Unsharp-mask style sharpening via 3x3 convolution, blended by strength. */
function sharpen(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
) {
  if (strength <= 0) return
  const amount = (strength / 100) * 0.9
  const src = ctx.getImageData(0, 0, width, height)
  const out = ctx.createImageData(width, height)
  const s = src.data
  const d = out.data
  const w4 = width * 4

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * w4 + x * 4
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        d[i] = s[i]
        d[i + 1] = s[i + 1]
        d[i + 2] = s[i + 2]
        d[i + 3] = s[i + 3]
        continue
      }
      for (let c = 0; c < 3; c++) {
        const center = s[i + c]
        const blur =
          (s[i - w4 + c] + s[i + w4 + c] + s[i - 4 + c] + s[i + 4 + c]) / 4
        d[i + c] = clamp(center + (center - blur) * amount * 2.5)
      }
      d[i + 3] = s[i + 3]
    }
  }
  ctx.putImageData(out, 0, 0)
}

export interface EnhanceOptions {
  adjustments: Adjustments
  /** true = run the automatic HD pipeline (upscale + auto levels) */
  autoHD: boolean
  /** cap output width (use small value for fast live previews) */
  maxWidth?: number
}

/** Run the full enhancement pipeline. Returns a canvas with the result. */
export async function enhanceImage(
  src: string,
  options: EnhanceOptions,
): Promise<HTMLCanvasElement> {
  const img = await loadImage(src)
  const { adjustments, autoHD, maxWidth } = options

  let canvas: HTMLCanvasElement
  if (maxWidth && img.width > maxWidth) {
    // Downscale for fast previews
    const scale = maxWidth / img.width
    canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const c = canvas.getContext('2d')!
    c.imageSmoothingEnabled = true
    c.imageSmoothingQuality = 'high'
    c.drawImage(img, 0, 0, canvas.width, canvas.height)
  } else if (autoHD) {
    canvas = upscaleToHD(img)
  } else {
    canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    canvas.getContext('2d')!.drawImage(img, 0, 0)
  }

  const ctx = canvas.getContext('2d')!
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  if (autoHD) {
    autoLevels(imageData.data, (adjustments.enhance / 100) * 0.6)
  }
  applyTone(imageData.data, adjustments)
  ctx.putImageData(imageData, 0, 0)

  sharpen(ctx, canvas.width, canvas.height, adjustments.sharpness)

  return canvas
}

/** Export a canvas to a JPEG data URL at the given quality (0..100). */
export function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  quality = 92,
): string {
  return canvas.toDataURL('image/jpeg', Math.min(100, Math.max(5, quality)) / 100)
}

/** Trigger a download so the photo saves to the device. */
export function savePhotoToDevice(dataUrl: string, name?: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = name ?? `snapai-${Date.now()}.jpg`
  document.body.appendChild(a)
  a.click()
  a.remove()
}
