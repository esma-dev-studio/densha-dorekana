import { describe, expect, it } from 'vitest'
import { trains } from './data/trains.js'
import { createFuriganaEntries, readingForText } from './furigana.js'

const entries = createFuriganaEntries(trains)
const hasKanji = /\p{Script=Han}/u

describe('furigana dictionary', () => {
  it('has a reading for every train name', () => {
    trains.forEach((train) => {
      expect(readingForText(train.name, entries), train.name).toBe(train.reading)
    })
  })

  it('has a reading for every kanji route used by the quiz and encyclopedia', () => {
    const routes = new Set(trains.flatMap((train) => train.mainLines).filter((line) => hasKanji.test(line)))
    routes.forEach((route) => {
      expect(readingForText(route, entries), route).not.toBe('')
    })
  })

  it('has readings for operators and regions shown beside train names', () => {
    const labels = new Set(trains.flatMap((train) => [train.operator, train.region]).filter((label) => hasKanji.test(label)))
    labels.forEach((label) => {
      expect(readingForText(label, entries), label).not.toBe('')
    })
  })
})
