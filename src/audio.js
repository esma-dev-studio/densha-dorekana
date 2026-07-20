let audioContext

const tone = (frequency, duration, volume = 0.035, delay = 0) => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return
  audioContext ??= new AudioContextClass()
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0, audioContext.currentTime + delay)
  gain.gain.linearRampToValueAtTime(volume, audioContext.currentTime + delay + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + delay + duration)
  oscillator.connect(gain).connect(audioContext.destination)
  oscillator.start(audioContext.currentTime + delay)
  oscillator.stop(audioContext.currentTime + delay + duration + 0.02)
}

export const playSound = (kind, enabled) => {
  if (!enabled) return
  if (kind === 'correct') {
    tone(660, 0.16)
    tone(880, 0.2, 0.035, 0.12)
  } else if (kind === 'wrong') {
    tone(220, 0.2, 0.025)
  } else if (kind === 'finish') {
    tone(523, 0.16)
    tone(659, 0.16, 0.035, 0.12)
    tone(784, 0.3, 0.035, 0.24)
  } else {
    tone(440, 0.1, 0.025)
  }
}
