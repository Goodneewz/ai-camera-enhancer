'use client'

import { ArrowLeft, Download } from 'lucide-react'
import type { CapturedVideo } from '@/lib/types'
import { savePhotoToDevice } from '@/lib/enhance'

interface VideoPlayerProps {
  video: CapturedVideo
  onBack: () => void
}

export function VideoPlayer({ video, onBack }: VideoPlayerProps) {
  const extension = video.mimeType.includes('mp4') ? 'mp4' : 'webm'

  const handleDownload = () => {
    savePhotoToDevice(video.url, `snapai-video-${video.id}.${extension}`)
  }

  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-sm font-medium"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </button>
        <h1 className="text-sm font-semibold tracking-wide">Video</h1>
        <span className="w-[72px]" />
      </header>

      <div className="mx-4 flex-1 overflow-hidden rounded-2xl bg-card">
        <video
          src={video.url}
          controls
          autoPlay
          playsInline
          className="h-full w-full object-contain"
        />
      </div>

      <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <button
          type="button"
          onClick={handleDownload}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
        >
          <Download className="size-4" aria-hidden="true" />
          Save to Phone
        </button>
      </div>
    </div>
  )
}
