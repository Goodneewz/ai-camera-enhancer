export interface CapturedPhoto {
  id: string
  /** Raw capture straight from the camera sensor */
  original: string
  /** Auto-enhanced HD version (same as original if auto-enhance was off) */
  enhanced: string
  autoEnhanced: boolean
  takenAt: number
}
