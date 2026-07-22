import { describe, expect, it } from 'vitest'
import { imageCredits } from './data/imageCredits.js'
import { trains } from './data/trains.js'
import {
  answerFor,
  buildQuestionSet,
  dailyQuestionIds,
  generateOptions,
  masteryLevel,
  pointsForHints,
  questionTypeFor,
  rankForXp,
  resultTitle,
  selectReviewIds,
  validateTrainData,
} from './logic.js'

describe('train quiz data and game logic', () => {
  it('contains 45 valid trains with at least ten per difficulty', () => {
    expect(trains).toHaveLength(45)
    expect(validateTrainData(trains)).toEqual([])
    for (const difficulty of ['easy', 'normal', 'hard']) {
      expect(trains.filter((train) => train.difficulty === difficulty).length).toBeGreaterThanOrEqual(10)
    }
  })

  it('has a licensed local photo and attribution for every train', () => {
    expect(Object.keys(imageCredits)).toHaveLength(trains.length)
    for (const train of trains) {
      const credit = imageCredits[train.id]
      expect(credit).toBeDefined()
      expect(credit.localPath).toBe(`./images/${train.id}.webp`)
      expect(credit.author).toBeTruthy()
      expect(credit.license).toBeTruthy()
      expect(credit.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
      expect(credit.license).not.toBe('プレースホルダー')
    }
  })
  it('builds ten unique questions for every difficulty', () => {
    for (const difficulty of ['easy', 'normal', 'hard']) {
      const questions = buildQuestionSet(trains, difficulty, { seed: 20260720 })
      expect(questions).toHaveLength(10)
      expect(new Set(questions.map((question) => question.trainId)).size).toBe(10)
      expect(questions.every((question) => question.options.length === 4)).toBe(true)
      expect(questions.every((question) => new Set(question.options).size === 4)).toBe(true)
      expect(questions.every((question) => question.type === questionTypeFor(trains.find((train) => train.id === question.trainId)))).toBe(true)
    }
  })

  it('asks formal names for named trains and routes for ordinary trains', () => {
    const vse = trains.find((train) => train.id === 'odakyu-vse')
    const yamanote = trains.find((train) => train.id === 'e235-yamanote')
    expect(questionTypeFor(vse)).toBe('name')
    expect(answerFor(vse, 'name')).toBe('小田急50000形 VSE')
    expect(questionTypeFor(yamanote)).toBe('line')
    expect(answerFor(yamanote, 'line')).toBe('山手線')
    expect(trains.filter((train) => questionTypeFor(train) === 'name').length).toBeGreaterThan(10)
    expect(trains.filter((train) => questionTypeFor(train) === 'line').length).toBeGreaterThan(10)
  })

  it('never creates duplicate or multiple-correct option labels', () => {
    for (const train of trains) {
      for (const type of ['name', 'series', 'operator', 'line']) {
        const options = generateOptions(train, type, trains, () => 0.42)
        expect(options).toHaveLength(4)
        expect(new Set(options).size).toBe(4)
      }
    }
  })

  it('applies the documented hint score and titles', () => {
    expect([0, 1, 2, 3].map(pointsForHints)).toEqual([100, 80, 60, 40])
    expect([0, 4, 7, 9, 10].map((count) => resultTitle(count))).toEqual(['電車たんけん隊', '駅員さん', '車掌さん', '運転士', '電車マスター'])
  })

  it('builds a deterministic three-difficulty daily challenge', () => {
    const first = dailyQuestionIds(trains, '2026-07-22')
    const again = dailyQuestionIds(trains, '2026-07-22')
    expect(first).toEqual(again)
    expect(first).toHaveLength(3)
    expect(new Set(first.map((id) => trains.find((train) => train.id === id).difficulty))).toEqual(new Set(['easy', 'normal', 'hard']))
  })

  it('keeps review sessions limited to the actual weak trains', () => {
    const reviewIds = ['e5-hayabusa', 'e6-komachi']
    const questions = buildQuestionSet(trains, 'review', { seed: 22, reviewIds, count: 10, exactReview: true })
    expect(questions.map((question) => question.trainId).sort()).toEqual([...reviewIds].sort())
  })

  it('calculates mastery and XP ranks', () => {
    expect(masteryLevel({ correct: 0, wrong: 2 })).toBe(0)
    expect(masteryLevel({ correct: 1, wrong: 1 })).toBe(1)
    expect(masteryLevel({ correct: 2, wrong: 1 })).toBe(2)
    expect(masteryLevel({ correct: 4, wrong: 1 })).toBe(3)
    expect(rankForXp(0).name).toBe('電車たんけん隊')
    expect(rankForXp(1600).name).toBe('電車博士')
  })
  it('prioritizes trains with repeated mistakes for review', () => {
    const progress = {
      trainStats: {
        'e5-hayabusa': { correct: 1, wrong: 4 },
        'e6-komachi': { correct: 4, wrong: 1 },
      },
    }
    expect(selectReviewIds(progress, trains, 2)).toEqual(['e5-hayabusa', 'e6-komachi'])
  })
})
