'use client'

import { ArrowLeft, Sparkles, Trash2, ImageIcon } from 'lucide-react'
import type { CapturedPhoto } from '@/lib/types'

interface GalleryProps {
  photos: CapturedPhoto[]
  onBack: () => void
  onSelect: (photo: CapturedPhoto) => void
  onDelete: (id: string) => void
}

export function Gallery({ photos, onBack, onSelect, onDelete }: GalleryProps) {
  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-sm font-medium"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Camera
        </button>
        <h1 className="text-sm font-semibold tracking-wide">Gallery</h1>
        <span className="w-[88px] text-right font-mono text-xs text-muted-foreground">
          {photos.length} {photos.length === 1 ? 'shot' : 'shots'}
        </span>
      </header>

      {photos.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <ImageIcon className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground text-pretty">
            No photos yet. Snap something and it&apos;ll show up here, auto-enhanced to HD.
          </p>
        </div>
      ) : (
        <div className="grid flex-1 auto-rows-min grid-cols-3 gap-1 overflow-y-auto p-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg bg-card">
              <button
                type="button"
                onClick={() => onSelect(photo)}
                className="h-full w-full"
                aria-label={`Edit photo taken at ${new Date(photo.takenAt).toLocaleTimeString()}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.enhanced || "/placeholder.svg"}
                  alt={`Captured at ${new Date(photo.takenAt).toLocaleTimeString()}`}
                  className="h-full w-full object-cover"
                />
              </button>
              {photo.autoEnhanced && (
                <span className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-semibold text-primary backdrop-blur-sm">
                  <Sparkles className="size-2.5" aria-hidden="true" />
                  HD
                </span>
              )}
              <button
                type="button"
                onClick={() => onDelete(photo.id)}
                className="absolute bottom-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-background/70 text-destructive backdrop-blur-sm"
                aria-label="Delete photo"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
