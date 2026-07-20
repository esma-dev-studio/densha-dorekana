export const QUESTION_LABELS = {
  name: 'この電車はどれ？',
  series: 'この車両の形式は？',
  operator: 'この車両の鉄道会社は？',
  line: 'この車両が主に走る路線は？',
}

export const answerFor = (train, type) => {
  if (type === 'series') return train.series
  if (type === 'operator') return train.operator
  if (type === 'line') return train.mainLines[0]
  return train.shortName
}

export const seededRandom = (seed = Date.now()) => {
  let state = Math.abs(Math.floor(seed)) || 1
  return () => {
    state = (state * 48271) % 2147483647
    return (state - 1) / 2147483646
  }
}

export const shuffle = (items, random = Math.random) => {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

export const questionTypeFor = (difficulty, index) => {
  if (difficulty === 'easy') return 'name'
  if (difficulty === 'normal') return ['name', 'series', 'operator'][index % 3]
  return ['series', 'operator', 'line'][index % 3]
}

const candidateScore = (correct, candidate, difficulty) => {
  if (difficulty === 'easy') {
    return (correct.category !== candidate.category ? 6 : 0)
      + (correct.ownership !== candidate.ownership ? 3 : 0)
      + (correct.operator !== candidate.operator ? 1 : 0)
  }
  if (difficulty === 'normal') {
    return (correct.category === candidate.category ? 5 : 0)
      + (correct.ownership === candidate.ownership ? 2 : 0)
      + (correct.region === candidate.region ? 1 : 0)
  }
  return (correct.operator === candidate.operator ? 6 : 0)
    + (correct.category === candidate.category ? 4 : 0)
    + (correct.ownership === candidate.ownership ? 2 : 0)
    + (correct.region === candidate.region ? 1 : 0)
}

export const generateOptions = (correct, type, allTrains, random = Math.random) => {
  const correctAnswer = answerFor(correct, type)
  const candidates = allTrains.filter((train) => train.id !== correct.id && answerFor(train, type) !== correctAnswer)
  const fixed = (correct.distractorIds ?? [])
    .map((id) => candidates.find((train) => train.id === id))
    .filter(Boolean)
  const ranked = shuffle(candidates, random)
    .sort((left, right) => candidateScore(correct, right, correct.difficulty) - candidateScore(correct, left, correct.difficulty))
  const chosen = []
  for (const candidate of [...fixed, ...ranked]) {
    const answer = answerFor(candidate, type)
    if (!chosen.some((item) => answerFor(item, type) === answer)) chosen.push(candidate)
    if (chosen.length === 3) break
  }
  if (chosen.length < 3) throw new Error(`選択肢を4つ生成できません: ${correct.id}/${type}`)
  return shuffle([correctAnswer, ...chosen.map((train) => answerFor(train, type))], random)
}

export const buildQuestionSet = (allTrains, difficulty, options = {}) => {
  const { count = 10, seed = Date.now(), reviewIds = [] } = options
  const random = seededRandom(seed)
  const difficultyPool = allTrains.filter((train) => train.difficulty === difficulty)
  const reviewPool = reviewIds.map((id) => allTrains.find((train) => train.id === id)).filter(Boolean)
  const source = reviewIds.length
    ? [...reviewPool, ...shuffle(allTrains.filter((train) => !reviewIds.includes(train.id)), random)]
    : shuffle(difficultyPool, random)
  const unique = Array.from(new Map(source.map((train) => [train.id, train])).values()).slice(0, count)
  if (unique.length < count) throw new Error(`${difficulty}の問題が${count}件必要です`)
  return unique.map((train, index) => {
    const type = questionTypeFor(reviewIds.length ? train.difficulty : difficulty, index)
    return {
      trainId: train.id,
      type,
      options: generateOptions(train, type, allTrains, random),
    }
  })
}

export const pointsForHints = (hintCount) => [100, 80, 60, 40][Math.min(3, Math.max(0, hintCount))]

export const selectReviewIds = (progress, allTrains, limit = 10) => {
  return allTrains
    .map((train) => {
      const stats = progress.trainStats?.[train.id] ?? { correct: 0, wrong: 0 }
      const attempts = stats.correct + stats.wrong
      return { id: train.id, wrong: stats.wrong, rate: attempts ? stats.wrong / attempts : 0 }
    })
    .filter((item) => item.wrong > 0)
    .sort((left, right) => right.rate - left.rate || right.wrong - left.wrong)
    .slice(0, limit)
    .map((item) => item.id)
}

export const resultTitle = (correctCount) => {
  if (correctCount === 10) return '電車マスター'
  if (correctCount === 9) return '運転士'
  if (correctCount >= 7) return '車掌さん'
  if (correctCount >= 4) return '駅員さん'
  return '電車たんけん隊'
}

export const sessionSummary = (session) => {
  const correct = session.answers.filter((answer) => answer.correct).length
  const totalSeconds = session.answers.reduce((sum, answer) => sum + answer.answerSeconds, 0)
  return {
    correct,
    rate: session.answers.length ? Math.round((correct / session.answers.length) * 100) : 0,
    averageSeconds: session.answers.length ? totalSeconds / session.answers.length : 0,
    wrongIds: session.answers.filter((answer) => !answer.correct).map((answer) => answer.trainId),
    title: resultTitle(correct),
  }
}

export const validateTrainData = (allTrains) => {
  const errors = []
  if (new Set(allTrains.map((train) => train.id)).size !== allTrains.length) errors.push('IDが重複しています')
  for (const difficulty of ['easy', 'normal', 'hard']) {
    if (allTrains.filter((train) => train.difficulty === difficulty).length < 10) errors.push(`${difficulty}が10件未満です`)
  }
  for (const train of allTrains) {
    if (train.hints.length !== 3) errors.push(`${train.id}: ヒントは3件必要です`)
    if (train.distinguishingPoints.length < 3) errors.push(`${train.id}: 見分け方が不足しています`)
    if (!train.imageCredit?.license) errors.push(`${train.id}: 画像ライセンスがありません`)
  }
  return errors
}
