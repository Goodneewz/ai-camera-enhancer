'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Sparkles,
  SwitchCamera,
  ImageIcon,
  Zap,
  CameraOff,
  Upload,
  Video,
  Camera as CameraIcon,
} from 'lucide-react'
import type { CapturedPhoto, CapturedVideo } from '@/lib/types'
import { AUTO_ENHANCE, canvasToDataUrl, enhanceImage } from '@/lib/enhance'

type CaptureMode = 'photo' | 'video'

interface CameraViewProps {
  autoEnhance: boolean
  onToggleAutoEnhance: () => void
  onCapture: (photo: CapturedPhoto) => void
  onCaptureVideo: (video: CapturedVideo) => void
  latestThumb?: string
  onOpenGallery: () => void
}

// Pick the best supported video mime type for MediaRecorder across browsers.
function pickVideoMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)) {
      return type
    }
  }
  return 'video/webm'
}

export function CameraView({
  autoEnhance,
  onToggleAutoEnhance,
  onCapture,
  onCaptureVideo,
  latestThumb,
  onOpenGallery,
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)
  const [processing, setProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<CaptureMode>('photo')
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCamera = useCallback(async (facingMode: 'environment' | 'user') => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      const videoConstraints = {
        facingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      }
      let stream: MediaStream
      try {
        // Request mic audio too so recorded videos aren't silent.
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: true,
        })
      } catch {
        // Fall back to video-only if mic access is denied/unavailable.
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        })
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setError(null)
    } catch {
      setError(
        'Camera unavailable. Allow camera access, or import a photo below to try the enhancer.',
      )
    }
  }, [])

  useEffect(() => {
    startCamera(facing)
    return () => {
      mediaRecorderRef.current?.state === 'recording' && mediaRecorderRef.current.stop()
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [facing, startCamera])

  const startRecording = useCallback(() => {
    const stream = streamRef.current
    if (!stream || isRecording) return
    chunksRef.current = []
    const mimeType = pickVideoMimeType()
    const recorder = new MediaRecorder(stream, { mimeType })
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const url = URL.createObjectURL(blob)
      onCaptureVideo({
        id: `${Date.now()}`,
        url,
        mimeType,
        durationSeconds: recordSeconds,
        takenAt: Date.now(),
      })
      chunksRef.current = []
    }
    mediaRecorderRef.current = recorder
    recorder.start()
    setIsRecording(true)
    setRecordSeconds(0)
    recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
  }, [isRecording, onCaptureVideo, recordSeconds])

  const stopRecording = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }, [])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const processCapture = useCallback(
    async (rawDataUrl: string) => {
      setProcessing(true)
      try {
        let enhancedUrl = rawDataUrl
        if (autoEnhance) {
          const canvas = await enhanceImage(rawDataUrl, {
            adjustments: AUTO_ENHANCE,
            autoHD: true,
          })
          enhancedUrl = canvasToDataUrl(canvas, 92)
        }
        onCapture({
          id: `${Date.now()}`,
          original: rawDataUrl,
          enhanced: enhancedUrl,
          autoEnhanced: autoEnhance,
          takenAt: Date.now(),
        })
      } finally {
        setProcessing(false)
      }
    },
    [autoEnhance, onCapture],
  )

  const snap = useCallback(async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || processing) return
    setFlash(true)
    setTimeout(() => setFlash(false), 180)

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    if (facing === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)
    await processCapture(canvas.toDataURL('image/jpeg', 0.95))
  }, [facing, processing, processCapture])

  const onImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => processCapture(reader.result as string)
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    [processCapture],
  )

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-background">
      {/* Viewfinder */}
      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <CameraOff className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">
              {error}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Import a photo
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-cover ${facing === 'user' ? 'scale-x-[-1]' : ''}`}
            aria-label="Live camera viewfinder"
          />
        )}

        {/* Capture flash */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-foreground transition-opacity duration-150 ${flash ? 'opacity-70' : 'opacity-0'}`}
        />

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2 rounded-full bg-background/60 px-3 py-1.5 backdrop-blur-md">
            <Zap className="size-3.5 text-primary" aria-hidden="true" />
            <span className="font-mono text-xs font-semibold tracking-wider">
              SNAP<span className="text-primary">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Import photo from gallery"
              className="flex size-8 items-center justify-center rounded-full bg-background/60 backdrop-blur-md"
            >
              <Upload className="size-4" aria-hidden="true" />
            </button>

          <button
            type="button"
            onClick={onToggleAutoEnhance}
            aria-pressed={autoEnhance}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold backdrop-blur-md transition-colors ${
              autoEnhance
                ? 'bg-primary text-primary-foreground shadow-[0_0_20px_-2px] shadow-primary/60'
                : 'bg-background/60 text-muted-foreground'
            }`}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            {autoEnhance ? 'AI HD ON' : 'AI HD OFF'}
          </button>
          </div>
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute left-1/2 top-16 flex -translate-x-1/2 items-center gap-2 rounded-full bg-destructive/90 px-3 py-1.5 text-xs font-semibold text-destructive-foreground backdrop-blur-md">
            <span className="size-2 animate-pulse rounded-full bg-white" aria-hidden="true" />
            REC {formatTime(recordSeconds)}
          </div>
        )}

        {/* Processing overlay */}
        {processing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/15">
              <Sparkles className="size-6 animate-pulse text-primary" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">Enhancing to HD…</p>
          </div>
        )}
      </div>

      {/* Photo / Video mode tabs */}
      <div className="flex items-center justify-center gap-1 pb-1 pt-2">
        {(['photo', 'video'] as CaptureMode[]).map((m) => (
          <button
            key={m}
            type="button"
            disabled={isRecording}
            onClick={() => setMode(m)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
              mode === m ? 'bg-card text-foreground' : 'text-muted-foreground'
            }`}
          >
            {m === 'photo' ? (
              <CameraIcon className="size-3.5" aria-hidden="true" />
            ) : (
              <Video className="size-3.5" aria-hidden="true" />
            )}
            {m === 'photo' ? 'Photo' : 'Video'}
          </button>
        ))}
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-between px-10 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onOpenGallery}
          className="relative size-12 overflow-hidden rounded-xl border border-border bg-card"
          aria-label="Open gallery"
        >
          {latestThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={latestThumb || "/placeholder.svg"}
              alt="Latest captured photo"
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon className="m-auto size-5 text-muted-foreground" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={mode === 'photo' ? snap : isRecording ? stopRecording : startRecording}
          disabled={(mode === 'photo' && (processing || !!error)) || (mode === 'video' && !!error)}
          aria-label={mode === 'photo' ? 'Take photo' : isRecording ? 'Stop recording' : 'Start recording'}
          className="group relative flex size-[76px] items-center justify-center rounded-full border-4 border-foreground/90 disabled:opacity-40"
        >
          {mode === 'video' && isRecording ? (
            <span className="block size-6 rounded-md bg-destructive transition-transform group-active:scale-90" />
          ) : (
            <span
              className={`block size-[60px] rounded-full transition-transform group-active:scale-90 ${
                mode === 'video' ? 'bg-destructive' : autoEnhance ? 'bg-primary' : 'bg-foreground'
              }`}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          disabled={isRecording}
          className="flex size-12 items-center justify-center rounded-full bg-card disabled:opacity-40"
          aria-label="Switch camera"
        >
          <SwitchCamera className="size-5" aria-hidden="true" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onImportFile}
        className="sr-only"
        aria-label="Import photo from device"
      />
    </div>
  )
}
