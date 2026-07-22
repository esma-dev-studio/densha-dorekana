const STORAGE_KEY = 'densha-dorekana-progress-v1'
const SESSION_KEY = 'densha-dorekana-session-v1'
const SESSION_CONTENT_VERSION = 3

export const defaultProgress = () => ({
  version: 2,
  bestScores: { easy: 0, normal: 0, hard: 0 },
  plays: 0,
  totalCorrect: 0,
  totalQuestions: 0,
  maxStreak: 0,
  lastPlayedAt: null,
  trainStats: {},
  soundOn: true,
  silhouetteLocked: false,
  xp: 0,
  bookmarkedIds: [],
  achievements: [],
  daily: { lastCompletedDate: null, streak: 0, totalCompleted: 0, bestScore: 0 },
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
  const defaults = defaultProgress()
  return {
    ...defaults,
    ...saved,
    bestScores: { ...defaults.bestScores, ...saved.bestScores },
    daily: { ...defaults.daily, ...saved.daily },
    bookmarkedIds: Array.isArray(saved.bookmarkedIds) ? saved.bookmarkedIds : [],
    achievements: Array.isArray(saved.achievements) ? saved.achievements : [],
  }
}

export const saveProgress = (progress) => localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))

export const loadSession = () => {
  const session = safeParse(localStorage.getItem(SESSION_KEY), null)
  if (session && session.contentVersion !== SESSION_CONTENT_VERSION) {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
  return session
}
export const saveSession = (session) => localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, contentVersion: SESSION_CONTENT_VERSION }))
export const clearSession = () => localStorage.removeItem(SESSION_KEY)

const consecutiveDate = (previousKey, currentKey) => {
  if (!previousKey || !currentKey) return false
  const previous = new Date(`${previousKey}T00:00:00`)
  const current = new Date(`${currentKey}T00:00:00`)
  return Math.round((current - previous) / 86400000) === 1
}

export const applyCompletedSession = (progress, session) => {
  const next = structuredClone(progress)
  const correctCount = session.answers.filter((answer) => answer.correct).length
  next.plays += 1
  next.totalQuestions += session.answers.length
  next.totalCorrect += correctCount
  next.maxStreak = Math.max(next.maxStreak, session.maxStreak)
  next.lastPlayedAt = new Date().toISOString()
  next.xp = (next.xp ?? 0) + Math.round(session.score / 10) + (correctCount * 5)
  if (session.mode === 'regular') {
    next.bestScores[session.difficulty] = Math.max(next.bestScores[session.difficulty], session.score)
  }
  if (session.mode === 'daily' && session.dailyKey && next.daily.lastCompletedDate !== session.dailyKey) {
    next.daily.streak = consecutiveDate(next.daily.lastCompletedDate, session.dailyKey) ? next.daily.streak + 1 : 1
    next.daily.lastCompletedDate = session.dailyKey
    next.daily.totalCompleted += 1
    next.daily.bestScore = Math.max(next.daily.bestScore, session.score)
  }
  for (const answer of session.answers) {
    const stats = next.trainStats[answer.trainId] ?? { correct: 0, wrong: 0 }
    stats[answer.correct ? 'correct' : 'wrong'] += 1
    stats.lastSeenAt = next.lastPlayedAt
    next.trainStats[answer.trainId] = stats
  }
  return next
}

export const clearAllData = () => {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(SESSION_KEY)
}
