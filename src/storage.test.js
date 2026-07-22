import { describe, expect, it } from 'vitest'
import { applyCompletedSession, defaultProgress } from './storage.js'

const dailySession = (dailyKey) => ({
  mode: 'daily',
  dailyKey,
  difficulty: 'mixed',
  score: 200,
  maxStreak: 2,
  answers: [
    { trainId: 'spacia-x', correct: false },
    { trainId: 'e231-500', correct: true },
    { trainId: 'keisei-skyliner', correct: true },
  ],
})

describe('progress storage calculations', () => {
  it('adds XP, daily streaks, and per-train stats after a completed session', () => {
    const first = applyCompletedSession(defaultProgress(), dailySession('2026-07-22'))
    expect(first.plays).toBe(1)
    expect(first.totalCorrect).toBe(2)
    expect(first.totalQuestions).toBe(3)
    expect(first.xp).toBe(30)
    expect(first.daily).toMatchObject({ lastCompletedDate: '2026-07-22', streak: 1, totalCompleted: 1, bestScore: 200 })
    expect(first.trainStats['spacia-x'].wrong).toBe(1)
    expect(first.trainStats['e231-500'].correct).toBe(1)

    const sameDay = applyCompletedSession(first, dailySession('2026-07-22'))
    expect(sameDay.daily.totalCompleted).toBe(1)
    expect(sameDay.daily.streak).toBe(1)

    const nextDay = applyCompletedSession(sameDay, dailySession('2026-07-23'))
    expect(nextDay.daily.totalCompleted).toBe(2)
    expect(nextDay.daily.streak).toBe(2)
  })
})
