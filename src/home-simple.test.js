import { describe, expect, it } from 'vitest'
import { simpleHomeMarkup } from './home-simple.js'

const markup = simpleHomeMarkup({
  trainCount: 90,
  heroImage: '<img src="test.webp" alt="test">',
  savedSession: null,
  dailyDone: false,
  dailyStreak: 0,
  dateKey: '2026-07-24',
  reviewCount: 0,
  difficultyCards: '<button data-start="easy">かんたん</button><button data-start="normal">ふつう</button><button data-start="hard">むずかしい</button>',
  themeCourses: {
    shinkansen: { icon: 'S', label: '新幹線', note: '5問' },
    limited: { icon: 'E', label: '特急', note: '5問' },
    route: { icon: 'L', label: '路線', note: '5問' },
  },
  rank: { level: 1 },
  learned: 0,
  mastered: 0,
  totalRate: 0,
})

describe('simple home', () => {
  it('keeps the secondary courses collapsed by default', () => {
    expect(markup).toContain('<details class="home-course-picker">')
    expect(markup).not.toContain('<details class="home-course-picker" open>')
  })

  it('keeps all six course choices available', () => {
    expect(markup.match(/data-start=/g)).toHaveLength(4)
    expect(markup.match(/data-theme=/g)).toHaveLength(3)
  })

  it('shows only three primary action cards before opening course details', () => {
    expect(markup.match(/<article class="home-action-card/g)).toHaveLength(3)
  })
})
