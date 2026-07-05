'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Download,
  Sparkles,
  Sun,
  Contrast,
  Droplets,
  CloudSun,
  Aperture,
  Gauge,
  RotateCcw,
  Eye,
} from 'lucide-react'
import type { CapturedPhoto } from '@/lib/types'
import {
  type Adjustments,
  AUTO_ENHANCE,
  DEFAULT_ADJUSTMENTS,
  canvasToDataUrl,
  enhanceImage,
  savePhotoToDevice,
} from '@/lib/enhance'

interface PhotoEditorProps {
  photo: CapturedPhoto
  onBack: () => void
}

interface SliderDef {
  key: keyof Adjustments | 'quality'
  label: string
  icon: React.ReactNode
  min: number
  max: number
}

const SLIDERS: SliderDef[] = [
  { key: 'enhance', label: 'AI Enhance', icon: <Sparkles className="size-4" aria-hidden="true" />, min: 0, max: 100 },
  { key: 'shadows', label: 'Shadow Removal', icon: <CloudSun className="size-4" aria-hidden="true" />, min: 0, max: 100 },
  { key: 'sharpness', label: 'Sharpness', icon: <Aperture className="size-4" aria-hidden="true" />, min: 0, max: 100 },
  { key: 'brightness', label: 'Brightness', icon: <Sun className="size-4" aria-hidden="true" />, min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', icon: <Contrast className="size-4" aria-hidden="true" />, min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', icon: <Droplets className="size-4" aria-hidden="true" />, min: -100, max: 100 },
  { key: 'quality', label: 'Export Quality', icon: <Gauge className="size-4" aria-hidden="true" />, min: 10, max: 100 },
]

export function PhotoEditor({ photo, onBack }: PhotoEditorProps) {
  const startAdjustments = photo.autoEnhanced ? AUTO_ENHANCE : DEFAULT_ADJUSTMENTS
  const [adjustments, setAdjustments] = useState<Adjustments>(startAdjustments)
  const [quality, setQuality] = useState(92)
  const [preview, setPreview] = useState<string>(photo.enhanced)
  const [showOriginal, setShowOriginal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const renderToken = useRef(0)

  // Re-render preview (downscaled for speed) whenever sliders change
  useEffect(() => {
    const token = ++renderToken.current
    const t = setTimeout(async () => {
      try {
        const canvas = await enhanceImage(photo.original, {
          adjustments,
          autoHD: adjustments.enhance > 0,
          maxWidth: 900,
        })
        if (renderToken.current === token) {
          setPreview(canvasToDataUrl(canvas, 90))
          setSaved(false)
        }
      } catch (err) {
        console.log('[v0] Preview render failed:', err)
      }
    }, 120)
    return () => clearTimeout(t)
  }, [adjustments, photo.original])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      // Full-resolution render for export
      const canvas = await enhanceImage(photo.original, {
        adjustments,
        autoHD: adjustments.enhance > 0,
      })
      savePhotoToDevice(canvasToDataUrl(canvas, quality))
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }, [adjustments, photo.original, quality])

  const reset = useCallback(() => {
    setAdjustments(DEFAULT_ADJUSTMENTS)
    setQuality(92)
  }, [])

  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-sm font-medium"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </button>
        <h1 className="text-sm font-semibold tracking-wide">Edit Photo</h1>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Reset
        </button>
      </header>

      {/* Preview */}
      <div className="relative mx-4 flex-1 overflow-hidden rounded-2xl bg-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={showOriginal ? photo.original : preview}
          alt={showOriginal ? 'Original photo' : 'Enhanced photo preview'}
          className="h-full w-full object-contain"
        />
        <button
          type="button"
          onPointerDown={() => setShowOriginal(true)}
          onPointerUp={() => setShowOriginal(false)}
          onPointerLeave={() => setShowOriginal(false)}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-background/70 px-3.5 py-2 text-xs font-medium backdrop-blur-md"
        >
          <Eye className="size-3.5" aria-hidden="true" />
          {showOriginal ? 'Original' : 'Hold to compare'}
        </button>
        {showOriginal && (
          <span className="absolute left-3 top-3 rounded-full bg-background/70 px-3 py-1 text-xs font-semibold backdrop-blur-md">
            BEFORE
          </span>
        )}
      </div>

      {/* Sliders */}
      <div className="max-h-[38dvh] overflow-y-auto px-5 py-4">
        <div className="flex flex-col gap-4">
          {SLIDERS.map((s) => {
            const value = s.key === 'quality' ? quality : adjustments[s.key]
            return (
              <label key={s.key} className="flex flex-col gap-1.5">
                <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span className={s.key === 'enhance' ? 'text-primary' : ''}>{s.icon}</span>
                    {s.label}
                  </span>
                  <span className="font-mono tabular-nums text-foreground">{value}</span>
                </span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  value={value}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (s.key === 'quality') setQuality(v)
                    else setAdjustments((a) => ({ ...a, [s.key]: v }))
                  }}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
                  aria-label={s.label}
                />
              </label>
            )
          })}
        </div>
      </div>

      {/* Save */}
      <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Download className="size-4" aria-hidden="true" />
          {saving ? 'Rendering full HD…' : saved ? 'Saved to phone' : 'Save to Phone'}
        </button>
      </div>
    </div>
  )
}
