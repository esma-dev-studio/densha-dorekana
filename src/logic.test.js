import { describe, expect, it } from 'vitest'
import { imageCredits } from './data/imageCredits.js'
import { trains } from './data/trains.js'
import {
  buildQuestionSet,
  generateOptions,
  pointsForHints,
  resultTitle,
  selectReviewIds,
  validateTrainData,
} from './logic.js'

describe('train quiz data and game logic', () => {
  it('contains 30 valid trains split evenly across three difficulties', () => {
    expect(trains).toHaveLength(30)
    expect(validateTrainData(trains)).toEqual([])
    for (const difficulty of ['easy', 'normal', 'hard']) {
      expect(trains.filter((train) => train.difficulty === difficulty)).toHaveLength(10)
    }
  })

  it('has a licensed local photo and attribution for every train', () => {
    expect(Object.keys(imageCredits)).toHaveLength(30)
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
    }
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
    expect([0, 4, 7, 9, 10].map(resultTitle)).toEqual(['電車たんけん隊', '駅員さん', '車掌さん', '運転士', '電車マスター'])
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
