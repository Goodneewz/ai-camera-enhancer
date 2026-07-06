export interface CapturedPhoto {
  id: string
  /** Raw capture straight from the camera sensor */
  original: string
  /** Auto-enhanced HD version (same as original if auto-enhance was off) */
  enhanced: string
  autoEnhanced: boolean
  takenAt: number
}

export interface CapturedVideo {
  id: string
  /** Object URL pointing at the recorded video blob */
  url: string
  mimeType: string
  durationSeconds: number
  takenAt: number
}

export type MediaItem = ({ type: 'photo' } & CapturedPhoto) | ({ type: 'video' } & CapturedVideo)
