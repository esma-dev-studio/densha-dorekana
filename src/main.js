import './styles.css'
import { difficultyLabels, trainById, trains } from './data/trains.js'
import {
  QUESTION_LABELS,
  answerFor,
  buildQuestionSet,
  pointsForHints,
  selectReviewIds,
  sessionSummary,
  validateTrainData,
} from './logic.js'
import {
  applyCompletedSession,
  clearAllData,
  clearSession,
  loadProgress,
  loadSession,
  saveProgress,
  saveSession,
} from './storage.js'
import { playSound } from './audio.js'

const app = document.querySelector('#app')
const dataErrors = validateTrainData(trains)
let progress = loadProgress()
let session = null
let completedSession = null
let view = 'home'
let collectionFilters = { category: 'all', region: 'all', difficulty: 'all', status: 'all' }

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const trainImage = (train, className = '', eager = false) => `
  <img class="${className}" src="${escapeHtml(train.imagePath)}" alt="${escapeHtml(train.name)}の実車写真"
    ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} data-fallback-image="true" />`

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'まだ記録がありません'

const header = () => `
  <header class="site-header">
    <button class="brand" data-view="home" aria-label="電車どれかな？ ホーム">
      <span class="brand-mark" aria-hidden="true"><i></i><i></i></span>
      <span><strong>電車どれかな？</strong><small>DENSHA OBSERVATION QUIZ</small></span>
    </button>
    <nav aria-label="メインメニュー">
      <button data-view="home" ${view === 'home' ? 'aria-current="page"' : ''}>クイズ</button>
      <button data-view="collection" ${view === 'collection' ? 'aria-current="page"' : ''}>電車図鑑</button>
      <button data-view="stats" ${view === 'stats' ? 'aria-current="page"' : ''}>成績</button>
      <button data-view="credits" ${view === 'credits' ? 'aria-current="page"' : ''}>画像クレジット</button>
    </nav>
    <button class="sound-toggle" id="sound-toggle" aria-pressed="${progress.soundOn}" title="効果音を切り替える">
      <span aria-hidden="true">${progress.soundOn ? '♪' : '―'}</span> 音 ${progress.soundOn ? 'ON' : 'OFF'}
    </button>
  </header>`

const footer = () => `
  <footer class="site-footer">
    <p><strong>電車どれかな？</strong> 写真の特徴を観察して、見分ける力を育てるクイズです。</p>
    <div><button data-view="howto">遊び方</button><button data-view="credits">画像クレジット</button></div>
  </footer>`

const shell = (content, pageClass = '') => {
  app.innerHTML = `${header()}<main id="main-content" class="${pageClass}">${content}</main>${footer()}
    <dialog id="image-dialog" class="image-dialog"><button class="dialog-close" aria-label="拡大画像を閉じる">×</button><div id="dialog-image"></div></dialog>`
  bindGlobalEvents()
  bindImageFallbacks()
}

const renderHome = () => {
  const totalRate = progress.totalQuestions ? Math.round((progress.totalCorrect / progress.totalQuestions) * 100) : 0
  const reviewIds = selectReviewIds(progress, trains)
  const savedSession = loadSession()
  const heroTrain = trainById('e5-hayabusa')
  const difficultyCards = Object.entries(difficultyLabels).map(([key, item], index) => `
    <button class="difficulty-card" data-start="${key}" style="--level-color:${item.color}">
      <span class="level-index">0${index + 1}</span>
      <span class="level-copy"><small>LEVEL ${index + 1}</small><strong>${item.label}</strong><span>${item.note}</span></span>
      <span class="level-score">最高<br><b>${progress.bestScores[key]}</b> pt</span>
    </button>`).join('')

  shell(`
    <section class="home-hero">
      <div class="hero-copy">
        <p class="route-label"><span>観察</span><b>▶</b><span>発見</span><b>▶</b><span>電車博士</span></p>
        <h1>写真をよく見て、<br><em>電車のちがい</em>を発見しよう。</h1>
        <p>色・ライト・窓・先頭の形。正式な形式・愛称と走る路線まで分かる、全30車種の電車クイズです。</p>
        <button class="primary-action" data-start="easy">かんたんから出発 <span>→</span></button>
      </div>
      <div class="hero-photo">
        ${trainImage(heroTrain, '', true)}
        <div class="departure-board"><small>NEXT DEPARTURE</small><strong>電車クイズ　10問</strong><span>まもなく発車します</span></div>
        <button class="photo-credit-link" data-view="credits">写真のクレジットを見る</button>
      </div>
    </section>

    ${savedSession ? `<section class="resume-banner"><div><small>つづきがあります</small><strong>${savedSession.mode === 'review' ? '復習モード' : difficultyLabels[savedSession.difficulty]?.label}・${savedSession.currentIndex + 1}問目</strong></div><button id="resume-session">つづきから</button><button id="discard-session" class="text-button">最初から</button></section>` : ''}

    <section class="level-section" aria-labelledby="level-title">
      <div class="section-heading"><div><p>CHOOSE YOUR COURSE</p><h2 id="level-title">難易度をえらぶ</h2></div><span>各コース10問・同じ問題は出ません</span></div>
      <div class="quiz-format-guide" aria-label="出題ルール">
        <span>出題ルール</span>
        <p><strong>新幹線・特急</strong><small>E5系 はやぶさ、小田急50000形 VSEなど</small>形式＋愛称を当てる</p>
        <p><strong>通勤電車・地下鉄</strong><small>山手線、中央線快速、半蔵門線など</small>主に走る路線を当てる</p>
      </div>
      <div class="difficulty-list">${difficultyCards}</div>
    </section>

    <section class="home-grid">
      <article class="review-panel">
        <p class="panel-kicker">REVIEW LINE</p><h2>まちがえた電車を優先して復習</h2>
        <p>${reviewIds.length ? `${reviewIds.length}種類の苦手な電車があります。間違いの多い順に出題します。` : 'クイズで間違えた電車が、ここに自動で集まります。'}</p>
        <button id="start-review" ${reviewIds.length ? '' : 'disabled'}>復習モードを始める <span>${reviewIds.length}両</span></button>
      </article>
      <article class="quick-stats">
        <div><small>PLAY</small><strong>${progress.plays}</strong><span>回遊んだ</span></div>
        <div><small>ACCURACY</small><strong>${totalRate}<i>%</i></strong><span>累計正答率</span></div>
        <div><small>STREAK</small><strong>${progress.maxStreak}</strong><span>最大連続正解</span></div>
        <button data-view="stats">くわしい成績を見る →</button>
      </article>
      <article class="library-teaser">
        <div><p class="panel-kicker">TRAIN LIBRARY</p><h2>30種類の電車図鑑</h2><p>新幹線から地方私鉄まで、見分け方と豆知識を収録。</p><button data-view="collection">図鑑をひらく →</button></div>
        <div class="mini-line-map" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      </article>
    </section>
  `, 'home-page')

  document.querySelectorAll('[data-start]').forEach((button) => button.addEventListener('click', () => startQuiz(button.dataset.start)))
  document.querySelector('#start-review')?.addEventListener('click', startReview)
  document.querySelector('#resume-session')?.addEventListener('click', () => {
    session = loadSession()
    view = 'quiz'
    renderQuiz()
  })
  document.querySelector('#discard-session')?.addEventListener('click', () => {
    clearSession()
    renderHome()
  })
}

const startQuiz = (difficulty) => {
  const questions = buildQuestionSet(trains, difficulty, { seed: Date.now() })
  session = {
    id: `session-${Date.now()}`,
    mode: 'regular', difficulty, questions, currentIndex: 0, answers: [], score: 0,
    streak: 0, maxStreak: 0, hintsUsed: 0, revealedHints: 0, locked: false,
    selectedAnswer: null, startedAt: Date.now(), questionStartedAt: Date.now(),
  }
  saveSession(session)
  playSound('start', progress.soundOn)
  view = 'quiz'
  renderQuiz()
}

const startReview = () => {
  const reviewIds = selectReviewIds(progress, trains)
  if (!reviewIds.length) return
  const questions = buildQuestionSet(trains, 'easy', { seed: Date.now(), reviewIds })
  session = {
    id: `review-${Date.now()}`,
    mode: 'review', difficulty: 'review', questions, currentIndex: 0, answers: [], score: 0,
    streak: 0, maxStreak: 0, hintsUsed: 0, revealedHints: 0, locked: false,
    selectedAnswer: null, startedAt: Date.now(), questionStartedAt: Date.now(),
  }
  saveSession(session)
  playSound('start', progress.soundOn)
  view = 'quiz'
  renderQuiz()
}

const renderQuiz = () => {
  if (!session?.questions?.length) return renderHome()
  const question = session.questions[session.currentIndex]
  const train = trainById(question.trainId)
  const correctAnswer = answerFor(train, question.type)
  const answered = session.locked
  const lastAnswer = answered ? session.answers.at(-1) : null
  const choices = question.options.map((option, index) => {
    const isCorrect = answered && option === correctAnswer
    const isWrong = answered && option === session.selectedAnswer && option !== correctAnswer
    return `<button class="answer-choice ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}" data-answer="${escapeHtml(option)}" ${answered ? 'disabled' : ''}>
      <span>${index + 1}</span><strong>${escapeHtml(option)}</strong>${isCorrect ? '<i>正解</i>' : isWrong ? '<i>えらんだ答え</i>' : ''}
    </button>`
  }).join('')
  const hints = train.hints.slice(0, session.revealedHints).map((hint, index) => `<li><span>ヒント${index + 1}</span>${escapeHtml(hint)}</li>`).join('')
  const progressWidth = ((session.currentIndex + (answered ? 1 : 0)) / session.questions.length) * 100

  shell(`
    <section class="quiz-topbar">
      <button id="quit-quiz" class="back-link">← クイズをやめる</button>
      <div><span>${session.mode === 'review' ? '復習モード' : difficultyLabels[session.difficulty].label}</span><strong>${session.currentIndex + 1}<small> / ${session.questions.length}</small></strong></div>
      <div class="score-board"><span>SCORE <b>${session.score}</b></span><span>れんぞく <b>${session.streak}</b></span></div>
    </section>
    <div class="quiz-progress" aria-label="クイズの進み具合"><i style="width:${progressWidth}%"></i></div>
    <section class="quiz-layout">
      <div class="quiz-photo-column">
        <div class="photo-stage">
          ${trainImage(train, 'quiz-image', true)}
          <button class="zoom-button" id="zoom-image" aria-label="電車の画像を拡大する">＋ 拡大</button>
          <span class="photo-status">実車写真</span>
        </div>
        <div class="observation-tip"><span>観察ポイント</span><p>まずは答えを見ずに、<b>色・ライト・窓・先頭の形</b>を順番に見てみよう。</p></div>
      </div>
      <div class="question-column">
        <p class="question-type">QUESTION ${String(session.currentIndex + 1).padStart(2, '0')} ／ ${question.type === 'line' ? '路線を当てる' : '形式＋愛称を当てる'}</p>
        <h1>${QUESTION_LABELS[question.type]}</h1>
        <p class="keyboard-note">数字キー 1〜4 でも答えられます</p>
        <div class="answer-grid">${choices}</div>
        <div class="hint-area">
          <button id="show-hint" ${answered || session.revealedHints >= 3 ? 'disabled' : ''}><span>?</span>${session.revealedHints ? '次のヒントを見る' : 'ヒントを見る'}<small>残り ${3 - session.revealedHints}</small></button>
          <p>ヒントを使うと、この問題の点数は <strong>${pointsForHints(session.revealedHints)}点</strong></p>
          ${hints ? `<ol aria-live="polite">${hints}</ol>` : ''}
        </div>
      </div>
    </section>
    ${answered ? feedbackPanel(train, lastAnswer, correctAnswer) : ''}
  `, 'quiz-page')

  document.querySelectorAll('[data-answer]').forEach((button) => button.addEventListener('click', () => answerQuestion(button.dataset.answer)))
  document.querySelector('#show-hint')?.addEventListener('click', revealHint)
  document.querySelector('#next-question')?.addEventListener('click', nextQuestion)
  document.querySelector('#quit-quiz')?.addEventListener('click', () => {
    if (window.confirm('ここまでのクイズを保存してホームへ戻りますか？')) {
      saveSession(session)
      view = 'home'
      renderHome()
    }
  })
  document.querySelector('#zoom-image')?.addEventListener('click', () => openImageDialog(train))
  preloadNextImage()
}

const feedbackPanel = (train, answer, correctAnswer) => {
  const title = answer.correct ? '正解！ よく見分けました' : `おしい！ 正解は「${correctAnswer}」`
  return `<section class="answer-feedback ${answer.correct ? 'is-correct' : 'is-wrong'}" aria-live="polite">
    <div class="feedback-result"><span>${answer.correct ? '○' : '△'}</span><div><small>${answer.correct ? `+${answer.points} POINTS` : 'OBSERVATION CHANCE'}</small><h2>${escapeHtml(title)}</h2><p>${escapeHtml(train.name)} ／ ${escapeHtml(train.operator)}</p></div></div>
    <div class="learning-card">
      <div><small>正式な形式・愛称</small><strong>${escapeHtml(train.name)}</strong><span>${escapeHtml(train.operator)}</span></div>
      <div><small>主な路線・地域</small><strong>${escapeHtml(train.mainLines.join('・'))}</strong><span>${escapeHtml(train.region)}</span></div>
      <div><small>ここを見分ける</small><ul>${train.distinguishingPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul></div>
      <div><small>豆知識</small><p>${escapeHtml(train.trivia)}</p></div>
    </div>
    <button class="primary-action next-button" id="next-question">${session.currentIndex === session.questions.length - 1 ? '結果を見る' : '次の問題へ'} <span>→</span></button>
  </section>`
}

const revealHint = () => {
  if (session.locked || session.revealedHints >= 3) return
  session.revealedHints += 1
  session.hintsUsed += 1
  saveSession(session)
  renderQuiz()
}

const answerQuestion = (selectedAnswer) => {
  if (session.locked) return
  const question = session.questions[session.currentIndex]
  const train = trainById(question.trainId)
  const correctAnswer = answerFor(train, question.type)
  const correct = selectedAnswer === correctAnswer
  const points = correct ? pointsForHints(session.revealedHints) : 0
  const answerSeconds = Math.max(1, Math.round((Date.now() - session.questionStartedAt) / 1000))
  session.locked = true
  session.selectedAnswer = selectedAnswer
  session.score += points
  session.streak = correct ? session.streak + 1 : 0
  session.maxStreak = Math.max(session.maxStreak, session.streak)
  session.answers.push({
    questionIndex: session.currentIndex, trainId: train.id, type: question.type, selectedAnswer,
    correctAnswer, correct, points, hints: session.revealedHints, answerSeconds,
  })
  saveSession(session)
  playSound(correct ? 'correct' : 'wrong', progress.soundOn)
  renderQuiz()
}

const nextQuestion = () => {
  if (session.currentIndex === session.questions.length - 1) return finishQuiz()
  session.currentIndex += 1
  session.revealedHints = 0
  session.locked = false
  session.selectedAnswer = null
  session.questionStartedAt = Date.now()
  saveSession(session)
  renderQuiz()
}

const finishQuiz = () => {
  progress = applyCompletedSession(progress, session)
  saveProgress(progress)
  clearSession()
  completedSession = structuredClone(session)
  playSound('finish', progress.soundOn)
  view = 'result'
  renderResult()
}

const renderResult = () => {
  if (!completedSession) return renderHome()
  const summary = sessionSummary(completedSession)
  const wrongTrains = summary.wrongIds.map(trainById)
  shell(`
    <section class="result-hero">
      <p class="route-label"><span>終点</span><b>▶</b><span>結果発表</span></p>
      <span class="result-emblem">${summary.correct === 10 ? '10/10' : `${summary.correct}問正解`}</span>
      <p class="result-kicker">あなたの称号</p><h1>${summary.title}</h1>
      <p>${summary.correct >= 7 ? '細かな違いまで、よく観察できました。' : '見分け方を覚えれば、次はもっと正解できます。'}</p>
    </section>
    <section class="result-metrics">
      <div><small>SCORE</small><strong>${completedSession.score}</strong><span>ポイント</span></div>
      <div><small>ACCURACY</small><strong>${summary.rate}<i>%</i></strong><span>${summary.correct} / 10問</span></div>
      <div><small>MAX STREAK</small><strong>${completedSession.maxStreak}</strong><span>最大連続正解</span></div>
      <div><small>HINTS</small><strong>${completedSession.hintsUsed}</strong><span>使用回数</span></div>
      <div><small>AVG. TIME</small><strong>${summary.averageSeconds.toFixed(1)}<i>秒</i></strong><span>1問あたり</span></div>
    </section>
    <section class="wrong-review">
      <div class="section-heading"><div><p>REVIEW YOUR ANSWERS</p><h2>${wrongTrains.length ? 'まちがえた電車' : '全問正解です'}</h2></div><span>${wrongTrains.length ? '見分け方をもう一度確認しよう' : 'すばらしい観察力です'}</span></div>
      ${wrongTrains.length ? `<div class="wrong-list">${wrongTrains.map((train) => `<article>${trainImage(train)}<div><strong>${escapeHtml(train.name)}</strong><p>${escapeHtml(train.distinguishingPoints.join(' ／ '))}</p></div></article>`).join('')}</div>` : '<div class="perfect-message">30種類の図鑑も見て、次の難易度へ進んでみよう。</div>'}
    </section>
    <section class="result-actions">
      <button class="primary-action" id="retry-same">同じコースでもう一度 <span>→</span></button>
      <button data-view="home">別の難易度をえらぶ</button>
      <button id="review-wrong" ${wrongTrains.length ? '' : 'disabled'}>まちがえた問題を復習</button>
      <button data-view="collection">図鑑を見る</button>
    </section>
  `, 'result-page')
  document.querySelector('#retry-same')?.addEventListener('click', () => {
    if (completedSession.mode === 'review') startReview()
    else startQuiz(completedSession.difficulty)
  })
  document.querySelector('#review-wrong')?.addEventListener('click', () => {
    const questions = buildQuestionSet(trains, 'easy', { seed: Date.now(), reviewIds: summary.wrongIds })
    session = {
      id: `review-${Date.now()}`, mode: 'review', difficulty: 'review', questions, currentIndex: 0, answers: [], score: 0,
      streak: 0, maxStreak: 0, hintsUsed: 0, revealedHints: 0, locked: false, selectedAnswer: null,
      startedAt: Date.now(), questionStartedAt: Date.now(),
    }
    saveSession(session)
    view = 'quiz'
    renderQuiz()
  })
}

const renderCollection = () => {
  const categories = [...new Set(trains.map((train) => train.category))]
  const regions = [...new Set(trains.map((train) => train.region))]
  const filtered = trains.filter((train) => {
    const stats = progress.trainStats[train.id] ?? { correct: 0, wrong: 0 }
    return (collectionFilters.category === 'all' || train.category === collectionFilters.category)
      && (collectionFilters.region === 'all' || train.region === collectionFilters.region)
      && (collectionFilters.difficulty === 'all' || train.difficulty === collectionFilters.difficulty)
      && (collectionFilters.status === 'all' || (collectionFilters.status === 'cleared' ? stats.correct > 0 : stats.correct === 0))
  })
  shell(`
    <section class="page-intro"><p class="route-label"><span>LIBRARY</span><b>▶</b><span>30 TRAINS</span></p><h1>電車図鑑</h1><p>写真と観察ポイントを見比べて、電車の特徴を覚えよう。</p></section>
    <section class="collection-toolbar" aria-label="図鑑の絞り込み">
      <label>種類<select data-filter="category"><option value="all">すべて</option>${categories.map((value) => `<option ${collectionFilters.category === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>
      <label>地域<select data-filter="region"><option value="all">すべて</option>${regions.map((value) => `<option ${collectionFilters.region === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>
      <label>難易度<select data-filter="difficulty"><option value="all">すべて</option>${Object.entries(difficultyLabels).map(([key, item]) => `<option value="${key}" ${collectionFilters.difficulty === key ? 'selected' : ''}>${item.label}</option>`).join('')}</select></label>
      <label>記録<select data-filter="status"><option value="all">すべて</option><option value="cleared" ${collectionFilters.status === 'cleared' ? 'selected' : ''}>正解済み</option><option value="locked" ${collectionFilters.status === 'locked' ? 'selected' : ''}>未正解</option></select></label>
      <label class="silhouette-switch"><input type="checkbox" id="silhouette-toggle" ${progress.silhouetteLocked ? 'checked' : ''}> 未正解をシルエット表示</label>
      <strong>${filtered.length}<small> / 30種類</small></strong>
    </section>
    <section class="train-grid">${filtered.map(collectionCard).join('')}</section>
  `, 'collection-page')
  document.querySelectorAll('[data-filter]').forEach((select) => select.addEventListener('change', () => {
    collectionFilters[select.dataset.filter] = select.value
    renderCollection()
  }))
  document.querySelector('#silhouette-toggle')?.addEventListener('change', (event) => {
    progress.silhouetteLocked = event.target.checked
    saveProgress(progress)
    renderCollection()
  })
}

const collectionCard = (train) => {
  const stats = progress.trainStats[train.id] ?? { correct: 0, wrong: 0 }
  const hidden = progress.silhouetteLocked && stats.correct === 0
  return `<article class="train-card ${hidden ? 'silhouette' : ''}">
    <div class="card-photo">${trainImage(train)}<span>${difficultyLabels[train.difficulty].label}</span></div>
    <div class="card-body"><small>${escapeHtml(train.category)} ／ ${escapeHtml(train.operator)}</small><h2>${hidden ? '？？？' : escapeHtml(train.name)}</h2><p class="reading">${hidden ? 'クイズで正解すると表示されます' : escapeHtml(train.reading)}</p>
      <dl><div><dt>形式</dt><dd>${hidden ? '—' : escapeHtml(train.series)}</dd></div><div><dt>主な路線</dt><dd>${hidden ? '—' : escapeHtml(train.mainLines.join('・'))}</dd></div><div><dt>登場年</dt><dd>${hidden ? '—' : `${train.introducedYear}年`}</dd></div><div><dt>最高速度</dt><dd>${hidden ? '—' : escapeHtml(train.maxSpeed)}</dd></div></dl>
      <div class="record-strip"><span>正解 <b>${stats.correct}</b></span><span>まちがい <b>${stats.wrong}</b></span></div>
      ${hidden ? '' : `<details><summary>見分け方と豆知識</summary><h3>見分け方</h3><ul>${train.distinguishingPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul><h3>豆知識</h3><p>${escapeHtml(train.trivia)}</p></details>`}
    </div>
  </article>`
}

const renderStats = () => {
  const totalRate = progress.totalQuestions ? Math.round((progress.totalCorrect / progress.totalQuestions) * 100) : 0
  const weak = selectReviewIds(progress, trains, 6).map(trainById)
  const learned = trains.filter((train) => (progress.trainStats[train.id]?.correct ?? 0) > 0).length
  shell(`
    <section class="page-intro"><p class="route-label"><span>RECORD</span><b>▶</b><span>YOUR JOURNEY</span></p><h1>これまでの成績</h1><p>点数だけでなく、何を見分けられるようになったかを確認できます。</p></section>
    <section class="stats-board">
      <div><small>PLAY COUNT</small><strong>${progress.plays}</strong><span>プレイ回数</span></div>
      <div><small>TOTAL ACCURACY</small><strong>${totalRate}<i>%</i></strong><span>${progress.totalCorrect} / ${progress.totalQuestions}問</span></div>
      <div><small>BEST STREAK</small><strong>${progress.maxStreak}</strong><span>最大連続正解</span></div>
      <div><small>DISCOVERED</small><strong>${learned}<i>/30</i></strong><span>正解した電車</span></div>
    </section>
    <section class="course-records"><div class="section-heading"><div><p>COURSE RECORDS</p><h2>難易度別ベストスコア</h2></div><span>満点 1,000ポイント</span></div><div>${Object.entries(difficultyLabels).map(([key, item], index) => `<article style="--level-color:${item.color}"><span>0${index + 1}</span><div><small>${item.label}</small><strong>${progress.bestScores[key]}<i> pt</i></strong></div><progress max="1000" value="${progress.bestScores[key]}"></progress></article>`).join('')}</div></section>
    <section class="weak-section"><div class="section-heading"><div><p>REVIEW SIGNAL</p><h2>復習したい電車</h2></div><span>まちがい率が高い順</span></div>${weak.length ? `<div class="weak-list">${weak.map((train) => { const stats = progress.trainStats[train.id]; return `<article>${trainImage(train)}<div><strong>${escapeHtml(train.name)}</strong><span>正解 ${stats.correct} ／ まちがい ${stats.wrong}</span></div></article>` }).join('')}</div><button class="primary-action" id="stats-review">復習モードを始める <span>→</span></button>` : '<div class="empty-state">クイズを遊ぶと、苦手な電車がここに表示されます。</div>'}</section>
    <section class="data-settings"><div><small>LAST PLAYED</small><strong>${formatDate(progress.lastPlayedAt)}</strong></div><button id="reset-data">すべての成績を消去</button></section>
  `, 'stats-page')
  document.querySelector('#stats-review')?.addEventListener('click', startReview)
  document.querySelector('#reset-data')?.addEventListener('click', () => {
    if (window.confirm('保存した成績と途中のクイズをすべて消しますか？')) {
      clearAllData()
      progress = loadProgress()
      renderStats()
    }
  })
}

const renderCredits = () => {
  shell(`
    <section class="page-intro"><p class="route-label"><span>PHOTO</span><b>▶</b><span>ATTRIBUTION</span></p><h1>画像クレジット</h1><p>実車写真はWikimedia Commonsからローカル保存し、表示用WebPへ縮小変換しています。各ライセンスの条件は元ページで確認できます。</p></section>
    <section class="credit-notice"><strong>画像を使うときの約束</strong><p>写真の作者・出典・ライセンスを表示し、元ページとライセンス本文へリンクします。アプリから外部画像をホットリンクしていません。</p></section>
    <section class="credit-list">${trains.map((train, index) => `<article><span>${String(index + 1).padStart(2, '0')}</span>${trainImage(train)}<div><h2>${escapeHtml(train.name)}</h2><dl><div><dt>撮影者</dt><dd>${escapeHtml(train.imageCredit.author || '記載なし')}</dd></div><div><dt>ファイル</dt><dd>${escapeHtml(train.imageCredit.source)}</dd></div><div><dt>ライセンス</dt><dd>${escapeHtml(train.imageCredit.license)}${train.imageCredit.modified ? ' ／ WebPへ縮小変換' : ''}</dd></div></dl><p>${train.imageCredit.sourceUrl ? `<a href="${escapeHtml(train.imageCredit.sourceUrl)}" target="_blank" rel="noreferrer">Commonsの元ページ ↗</a>` : ''}${train.imageCredit.licenseUrl ? `<a href="${escapeHtml(train.imageCredit.licenseUrl)}" target="_blank" rel="noreferrer">ライセンス本文 ↗</a>` : ''}</p></div></article>`).join('')}</section>
  `, 'credits-page')
}

const renderHowTo = () => {
  shell(`
    <section class="page-intro"><p class="route-label"><span>GUIDE</span><b>▶</b><span>3 STEPS</span></p><h1>遊び方</h1><p>正解することよりも、「どこを見たら分かるか」を覚えるクイズです。</p></section>
    <section class="howto-steps">
      <article><span>01</span><div><small>OBSERVE</small><h2>写真をよく観察</h2><p>色だけで決めず、ライト・窓・先頭の形を順番に見ます。画像は拡大できます。</p></div></article>
      <article><span>02</span><div><small>ANSWER</small><h2>4つから答える</h2><p>タッチ・クリック・数字キーに対応。分からないときは3段階のヒントを使えます。</p></div></article>
      <article><span>03</span><div><small>LEARN</small><h2>見分け方を確認</h2><p>正解でも不正解でも、車体の観察ポイントと豆知識を読んでから次へ進みます。</p></div></article>
    </section>
    <section class="score-guide"><h2>ヒントと点数</h2><div><span>ヒントなし <b>100点</b></span><span>1回 <b>80点</b></span><span>2回 <b>60点</b></span><span>3回 <b>40点</b></span></div></section>
    <button class="primary-action centered" data-view="home">難易度をえらぶ <span>→</span></button>
  `, 'howto-page')
}

const bindGlobalEvents = () => {
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)))
  document.querySelector('#sound-toggle')?.addEventListener('click', () => {
    progress.soundOn = !progress.soundOn
    saveProgress(progress)
    if (progress.soundOn) playSound('start', true)
    renderCurrentView()
  })
  const dialog = document.querySelector('#image-dialog')
  document.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close())
  dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close() })
}

const bindImageFallbacks = () => {
  document.querySelectorAll('img[data-fallback-image]').forEach((image) => image.addEventListener('error', () => {
    if (image.dataset.fallbackApplied) return
    image.dataset.fallbackApplied = 'true'
    image.src = './images/placeholder.svg'
    image.alt = '実車写真を読み込めませんでした'
    image.closest('.photo-stage')?.classList.add('image-fallback')
  }))
}

const openImageDialog = (train) => {
  const dialog = document.querySelector('#image-dialog')
  document.querySelector('#dialog-image').innerHTML = `${trainImage(train, '', true)}<p>${escapeHtml(train.name)}</p>`
  bindImageFallbacks()
  dialog.showModal()
}

const preloadNextImage = () => {
  const nextQuestion = session.questions[session.currentIndex + 1]
  if (!nextQuestion) return
  const image = new Image()
  image.src = trainById(nextQuestion.trainId).imagePath
}

const setView = (nextView) => {
  view = nextView
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  renderCurrentView()
}

const renderCurrentView = () => {
  if (view === 'quiz') return renderQuiz()
  if (view === 'result') return renderResult()
  if (view === 'collection') return renderCollection()
  if (view === 'stats') return renderStats()
  if (view === 'credits') return renderCredits()
  if (view === 'howto') return renderHowTo()
  return renderHome()
}

window.addEventListener('keydown', (event) => {
  if (view !== 'quiz' || session?.locked || !['1', '2', '3', '4'].includes(event.key)) return
  const option = session.questions[session.currentIndex].options[Number(event.key) - 1]
  if (option) answerQuestion(option)
})

if (dataErrors.length) {
  shell(`<section class="fatal-error"><h1>問題データを確認してください</h1><ul>${dataErrors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul></section>`)
} else {
  renderHome()
}
