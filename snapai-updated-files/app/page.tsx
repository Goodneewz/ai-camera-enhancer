'use client'

import { useCallback, useState } from 'react'
import { CameraView } from '@/components/camera-view'
import { PhotoEditor } from '@/components/photo-editor'
import { VideoPlayer } from '@/components/video-player'
import { Gallery } from '@/components/gallery'
import type { CapturedPhoto, CapturedVideo, MediaItem } from '@/lib/types'
import { savePhotoToDevice } from '@/lib/enhance'

type Screen = 'camera' | 'gallery' | 'editor' | 'video'

export default function SnapAIApp() {
  const [screen, setScreen] = useState<Screen>('camera')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [autoEnhance, setAutoEnhance] = useState(true)
  const [activePhoto, setActivePhoto] = useState<CapturedPhoto | null>(null)
  const [activeVideo, setActiveVideo] = useState<CapturedVideo | null>(null)

  const handleCapture = useCallback((photo: CapturedPhoto) => {
    setMedia((prev) => [{ ...photo, type: 'photo' }, ...prev])
    // Auto-save the enhanced HD shot to the phone, just like a native camera
    savePhotoToDevice(photo.enhanced, `snapai-hd-${photo.id}.jpg`)
  }, [])

  const handleCaptureVideo = useCallback((video: CapturedVideo) => {
    setMedia((prev) => [{ ...video, type: 'video' }, ...prev])
  }, [])

  const handleDelete = useCallback((id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const openItem = useCallback((item: MediaItem) => {
    if (item.type === 'photo') {
      setActivePhoto(item)
      setScreen('editor')
    } else {
      setActiveVideo(item)
      setScreen('video')
    }
  }, [])

  const latestThumb = media.find((m) => m.type === 'photo') as (CapturedPhoto & { type: 'photo' }) | undefined

  return (
    <main className="mx-auto h-dvh max-w-md overflow-hidden">
      {screen === 'camera' && (
        <CameraView
          autoEnhance={autoEnhance}
          onToggleAutoEnhance={() => setAutoEnhance((v) => !v)}
          onCapture={handleCapture}
          onCaptureVideo={handleCaptureVideo}
          latestThumb={latestThumb?.enhanced}
          onOpenGallery={() => setScreen('gallery')}
        />
      )}
      {screen === 'gallery' && (
        <Gallery
          photos={media}
          onBack={() => setScreen('camera')}
          onSelect={openItem}
          onDelete={handleDelete}
        />
      )}
      {screen === 'editor' && activePhoto && (
        <PhotoEditor photo={activePhoto} onBack={() => setScreen('gallery')} />
      )}
      {screen === 'video' && activeVideo && (
        <VideoPlayer video={activeVideo} onBack={() => setScreen('gallery')} />
      )}
    </main>
  )
}
