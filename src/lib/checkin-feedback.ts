/**
 * Check-in Feedback Utility
 *
 * Provides audio and haptic feedback for check-in operations
 */

// Audio context singleton
let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null

  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)()
    } catch (e) {
      console.warn("AudioContext not supported")
      return null
    }
  }

  // Resume if suspended (browser autoplay policy)
  if (audioContext.state === "suspended") {
    audioContext.resume()
  }

  return audioContext
}

/**
 * Play a success beep sound
 */
export function playSuccessSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  // Pleasant success sound - two ascending tones
  oscillator.type = "sine"
  oscillator.frequency.setValueAtTime(880, ctx.currentTime) // A5
  oscillator.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1) // C#6

  // Quick fade in/out
  gainNode.gain.setValueAtTime(0, ctx.currentTime)
  gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02)
  gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.15)
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2)

  oscillator.start(ctx.currentTime)
  oscillator.stop(ctx.currentTime + 0.2)
}

/**
 * Play an error beep sound
 */
export function playErrorSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  // Error sound - low buzzer
  oscillator.type = "square"
  oscillator.frequency.setValueAtTime(200, ctx.currentTime)

  // Two quick beeps
  gainNode.gain.setValueAtTime(0, ctx.currentTime)
  gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02)
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1)
  gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.15)
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25)

  oscillator.start(ctx.currentTime)
  oscillator.stop(ctx.currentTime + 0.25)
}

/**
 * Play a warning beep sound
 */
export function playWarningSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  // Warning sound - single mid tone
  oscillator.type = "triangle"
  oscillator.frequency.setValueAtTime(440, ctx.currentTime) // A4

  gainNode.gain.setValueAtTime(0, ctx.currentTime)
  gainNode.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02)
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3)

  oscillator.start(ctx.currentTime)
  oscillator.stop(ctx.currentTime + 0.3)
}

/**
 * Trigger device vibration (mobile)
 */
export function vibrate(pattern: number | number[] = 100): void {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern)
  }
}

/**
 * Success feedback (sound + vibration)
 */
export function successFeedback(): void {
  playSuccessSound()
  vibrate(50)
}

/**
 * Error feedback (sound + vibration)
 */
export function errorFeedback(): void {
  playErrorSound()
  vibrate([100, 50, 100])
}

/**
 * Warning feedback (sound + vibration)
 */
export function warningFeedback(): void {
  playWarningSound()
  vibrate([50, 50, 50])
}

/**
 * Check-in specific feedback
 */
export const checkinFeedback = {
  success: () => {
    successFeedback()
  },
  alreadyCheckedIn: () => {
    warningFeedback()
  },
  error: () => {
    errorFeedback()
  },
  notFound: () => {
    errorFeedback()
  },
}

/**
 * Initialize audio context on user interaction
 * Call this on first user click to enable audio
 */
export function initializeAudio(): void {
  getAudioContext()
}
