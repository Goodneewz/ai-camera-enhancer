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
  ChevronsLeftRight,
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
  const [comparePos, setComparePos] = useState(50)
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const renderToken = useRef(0)
  const compareRef = useRef<HTMLDivElement>(null)

  const moveHandleTo = useCallback((clientX: number) => {
    const el = compareRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setComparePos(Math.min(100, Math.max(0, pct)))
  }, [])

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

      {/* Preview: draggable before/after comparison */}
      <div
        ref={compareRef}
        className="relative mx-4 flex-1 touch-none select-none overflow-hidden rounded-2xl bg-card"
        onPointerDown={(e) => {
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          setDragging(true)
          moveHandleTo(e.clientX)
        }}
        onPointerMove={(e) => dragging && moveHandleTo(e.clientX)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        {/* AFTER (enhanced) — full width base layer */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview || '/placeholder.svg'}
          alt="AI-enhanced HD photo"
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />

        {/* BEFORE (original camera capture) — clipped to slider position */}
        <div
          className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - comparePos}% 0 0)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.original || '/placeholder.svg'}
            alt="Original camera photo"
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>

        {/* Draggable divider */}
        <div
          className="pointer-events-none absolute inset-y-0 w-[2px] bg-white/90 shadow-[0_0_8px_rgba(0,0,0,0.4)]"
          style={{ left: `${comparePos}%` }}
        >
          <div className="absolute top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg">
            <ChevronsLeftRight className="size-4" aria-hidden="true" />
          </div>
        </div>

        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-background/70 px-3 py-1 text-xs font-semibold backdrop-blur-md">
          BEFORE
        </span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-primary/85 px-3 py-1 text-xs font-semibold text-primary-foreground backdrop-blur-md">
          AFTER · HD
        </span>
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/70 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur-md">
          Drag to compare
        </p>
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
