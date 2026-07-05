'use client'

import { useCallback, useState } from 'react'
import { CameraView } from '@/components/camera-view'
import { PhotoEditor } from '@/components/photo-editor'
import { Gallery } from '@/components/gallery'
import type { CapturedPhoto } from '@/lib/types'
import { savePhotoToDevice } from '@/lib/enhance'

type Screen = 'camera' | 'gallery' | 'editor'

export default function SnapAIApp() {
  const [screen, setScreen] = useState<Screen>('camera')
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [autoEnhance, setAutoEnhance] = useState(true)
  const [activePhoto, setActivePhoto] = useState<CapturedPhoto | null>(null)

  const handleCapture = useCallback((photo: CapturedPhoto) => {
    setPhotos((prev) => [photo, ...prev])
    // Auto-save the enhanced HD shot to the phone, just like a native camera
    savePhotoToDevice(photo.enhanced, `snapai-hd-${photo.id}.jpg`)
  }, [])

  const handleDelete = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const openEditor = useCallback((photo: CapturedPhoto) => {
    setActivePhoto(photo)
    setScreen('editor')
  }, [])

  return (
    <main className="mx-auto h-dvh max-w-md overflow-hidden">
      {screen === 'camera' && (
        <CameraView
          autoEnhance={autoEnhance}
          onToggleAutoEnhance={() => setAutoEnhance((v) => !v)}
          onCapture={handleCapture}
          latestThumb={photos[0]?.enhanced}
          onOpenGallery={() => setScreen('gallery')}
        />
      )}
      {screen === 'gallery' && (
        <Gallery
          photos={photos}
          onBack={() => setScreen('camera')}
          onSelect={openEditor}
          onDelete={handleDelete}
        />
      )}
      {screen === 'editor' && activePhoto && (
        <PhotoEditor photo={activePhoto} onBack={() => setScreen('gallery')} />
      )}
    </main>
  )
}
