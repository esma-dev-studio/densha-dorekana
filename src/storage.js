const STORAGE_KEY = 'densha-dorekana-progress-v1'
const SESSION_KEY = 'densha-dorekana-session-v1'

export const defaultProgress = () => ({
  version: 1,
  bestScores: { easy: 0, normal: 0, hard: 0 },
  plays: 0,
  totalCorrect: 0,
  totalQuestions: 0,
  maxStreak: 0,
  lastPlayedAt: null,
  trainStats: {},
  soundOn: true,
  silhouetteLocked: false,
})

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

export const loadProgress = () => {
  const saved = safeParse(localStorage.getItem(STORAGE_KEY), {})
  return { ...defaultProgress(), ...saved, bestScores: { ...defaultProgress().bestScores, ...saved.bestScores } }
}

export const saveProgress = (progress) => localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))

export const loadSession = () => safeParse(localStorage.getItem(SESSION_KEY), null)
export const saveSession = (session) => localStorage.setItem(SESSION_KEY, JSON.stringify(session))
export const clearSession = () => localStorage.removeItem(SESSION_KEY)

export const applyCompletedSession = (progress, session) => {
  const next = structuredClone(progress)
  next.plays += 1
  next.totalQuestions += session.answers.length
  next.totalCorrect += session.answers.filter((answer) => answer.correct).length
  next.maxStreak = Math.max(next.maxStreak, session.maxStreak)
  next.lastPlayedAt = new Date().toISOString()
  if (session.mode === 'regular') {
    next.bestScores[session.difficulty] = Math.max(next.bestScores[session.difficulty], session.score)
  }
  for (const answer of session.answers) {
    const stats = next.trainStats[answer.trainId] ?? { correct: 0, wrong: 0 }
    stats[answer.correct ? 'correct' : 'wrong'] += 1
    next.trainStats[answer.trainId] = stats
  }
  return next
}

export const clearAllData = () => {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(SESSION_KEY)
}
