import './styles.css'
import './design-v3.css'
import './furigana.css'
import { difficultyLabels, trainById, trains } from './data/trains.js'
import {
  QUESTION_LABELS,
  answerFor,
  buildQuestionSet,
  dailyQuestionIds,
  masteryLevel,
  pointsForHints,
  rankForXp,
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
import { applyFurigana, createFuriganaEntries } from './furigana.js'

const app = document.querySelector('#app')
const dataErrors = validateTrainData(trains)
const furiganaEntries = createFuriganaEntries(trains)
let progress = loadProgress()
let session = null
let completedSession = null
let newlyUnlocked = []
let view = 'home'
let collectionFilters = { query: '', category: 'all', region: 'all', difficulty: 'all', status: 'all' }

const todayKey = () => {
  const today = new Date()
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-')
}

const themeCourses = {
  shinkansen: {
    label: '新幹線チャレンジ', icon: '◀▶', note: '全国の新幹線から5問',
    ids: trains.filter((train) => train.category === '新幹線').map((train) => train.id),
  },
  limited: {
    label: 'とっきゅう名鑑', icon: 'EXP', note: '愛称つき特急から5問',
    ids: trains.filter((train) => train.category === '特急').map((train) => train.id),
  },
  route: {
    label: '路線を当てよう', icon: 'LINE', note: '通勤電車・地下鉄から5問',
    ids: trains.filter((train) => ['通勤電車', '地下鉄'].includes(train.category)).map((train) => train.id),
  },
}

const achievementCatalog = [
  { id: 'first-trip', icon: '01', name: 'はじめての出発', note: 'クイズを1回完走', test: (state) => state.plays >= 1 },
  { id: 'ten-streak', icon: '10', name: 'ノンストップ', note: '10問連続正解', test: (state) => state.maxStreak >= 10 },
  { id: 'discover-10', icon: '☆', name: '車両ウォッチャー', note: '10種類に正解', test: (state) => Object.values(state.trainStats).filter((stats) => stats.correct > 0).length >= 10 },
  { id: 'master-5', icon: '★', name: '見分けの達人', note: '5種類を習熟度3へ', test: (state) => Object.values(state.trainStats).filter((stats) => masteryLevel(stats) === 3).length >= 5 },
  { id: 'daily-3', icon: '3D', name: '3日連続乗車', note: '今日の3問を3日連続クリア', test: (state) => state.daily.streak >= 3 },
  { id: 'all-lines', icon: 'ALL', name: '電車博士', note: `${trains.length}種類すべてに正解`, test: (state) => Object.values(state.trainStats).filter((stats) => stats.correct > 0).length >= trains.length },
]

const syncAchievements = (state) => {
  const before = new Set(state.achievements)
  const earned = achievementCatalog.filter((item) => item.test(state)).map((item) => item.id)
  state.achievements = [...new Set([...state.achievements, ...earned])]
  return state.achievements.filter((id) => !before.has(id))
}

const rankProgress = () => {
  const rank = rankForXp(progress.xp)
  const span = rank.next ? rank.next - rank.min : 1
  const value = rank.next ? Math.min(100, Math.round(((progress.xp - rank.min) / span) * 100)) : 100
  return { ...rank, value }
}

const masteryDots = (level) => `<span class="mastery-dots" aria-label="習熟度 ${level} / 3">${[1, 2, 3].map((step) => `<i class="${step <= level ? 'filled' : ''}"></i>`).join('')}</span>`

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const trainImage = (train, className = '', eager = false, altText = `${train.name}の実車写真`) => `
  <img class="${className}" src="${escapeHtml(train.imagePath)}" alt="${escapeHtml(altText)}"
    ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} data-fallback-image="true" />`

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'まだ記録がありません'

const header = () => {
  const rank = rankForXp(progress.xp)
  return `
  <header class="site-header">
    <button class="brand" data-view="home" aria-label="電車どれかな？ ホーム">
      <span class="brand-mark" aria-hidden="true"><i></i><i></i></span>
      <span><strong>電車どれかな？</strong><small>でんしゃ発見クイズ</small></span>
    </button>
    <nav aria-label="メインメニュー">
      <button data-view="home" ${['home', 'quiz', 'result'].includes(view) ? 'aria-current="page"' : ''}>あそぶ</button>
      <button data-view="collection" ${view === 'collection' ? 'aria-current="page"' : ''}>電車ずかん</button>
      <button data-view="stats" ${view === 'stats' ? 'aria-current="page"' : ''}>パスポート</button>
    </nav>
    <div class="header-tools">
      <button class="rank-chip" data-view="stats" aria-label="レベル${rank.level} ${rank.name}、${progress.xp} XP"><small>LV.${rank.level}</small><strong>${rank.name}</strong><span>${progress.xp} XP</span></button>
      <button class="sound-toggle" id="sound-toggle" aria-pressed="${progress.soundOn}" title="効果音を切り替える">
        <span aria-hidden="true">${progress.soundOn ? '♪' : '―'}</span> 音 ${progress.soundOn ? 'ON' : 'OFF'}
      </button>
    </div>
  </header>`
}

const footer = () => `
  <footer class="site-footer">
    <p><strong>電車どれかな？</strong> 写真の特徴を観察して、見分ける力を育てるクイズです。</p>
    <div><button data-view="howto">遊び方</button><button data-view="credits">画像クレジット</button></div>
  </footer>`

const mobileNav = () => `
  <nav class="mobile-nav" aria-label="スマートフォンメニュー">
    <button data-view="home" ${['home', 'quiz', 'result'].includes(view) ? 'aria-current="page"' : ''}><span aria-hidden="true">▶</span>あそぶ</button>
    <button data-view="collection" ${view === 'collection' ? 'aria-current="page"' : ''}><span aria-hidden="true">▦</span>ずかん</button>
    <button data-view="stats" ${view === 'stats' ? 'aria-current="page"' : ''}><span aria-hidden="true">★</span>パスポート</button>
  </nav>`

const shell = (content, pageClass = '') => {
  app.innerHTML = `<a class="skip-link" href="#main-content">本文へ移動</a>${header()}<main id="main-content" class="${pageClass}" tabindex="-1">${content}</main>${footer()}${mobileNav()}
    <dialog id="image-dialog" class="image-dialog"><button class="dialog-close" aria-label="拡大画像を閉じる">×</button><div id="dialog-image"></div></dialog>`
  applyFurigana(app, furiganaEntries)
  bindGlobalEvents()
  bindImageFallbacks()
}

const renderHome = () => {
  const totalRate = progress.totalQuestions ? Math.round((progress.totalCorrect / progress.totalQuestions) * 100) : 0
  const reviewIds = selectReviewIds(progress, trains)
  const savedSession = loadSession()
  const heroTrain = trainById('e5-hayabusa')
  const dateKey = todayKey()
  const dailyDone = progress.daily.lastCompletedDate === dateKey
  const rank = rankProgress()
  const learned = trains.filter((train) => (progress.trainStats[train.id]?.correct ?? 0) > 0).length
  const mastered = trains.filter((train) => masteryLevel(progress.trainStats[train.id]) === 3).length
  const nextAction = reviewIds.length
    ? { eyebrow: 'おすすめ', title: '苦手な電車を3両だけ復習', note: 'まちがいが多い電車から出題します。', action: 'review' }
    : { eyebrow: 'おすすめ', title: 'まずは「かんたん」10問', note: '有名な新幹線・特急から見分け方を覚えよう。', action: 'easy' }
  const difficultyCards = Object.entries(difficultyLabels).map(([key, item], index) => `
    <button class="difficulty-card" data-start="${key}" style="--level-color:${item.color}">
      <span class="level-index">0${index + 1}</span>
      <span class="level-copy"><small>LEVEL ${index + 1}</small><strong>${item.label}</strong><span>${item.note}</span></span>
      <span class="level-score">最高<br><b>${progress.bestScores[key]}</b> pt</span>
    </button>`).join('')

  shell(`
    <section class="home-hero">
      <div class="hero-copy">
        <p class="hero-kicker"><span aria-hidden="true">●</span> ${trains.length}しゅるいの電車に会える！</p>
        <h1>どの電車か、<br><em>わかるかな？</em></h1>
        <p>写真の「色・かたち・ライト」をよく見て、電車の名前や走る路線を当てよう。遊ぶほど、電車博士に近づくよ。</p>
        <button class="primary-action hero-action" data-start="easy"><span class="action-icon" aria-hidden="true">▶</span><span class="action-copy"><small>まずは かんたん10問</small><strong>電車クイズに出発！</strong></span><span class="action-arrow" aria-hidden="true">→</span></button>
        <div class="hero-facts" aria-label="アプリの特長"><span><b>${trains.length}</b>種類</span><span><b>3</b>レベル</span><span><b>2</b>分から</span></div>
      </div>
      <div class="hero-photo">
        ${trainImage(heroTrain, '', true)}
        <div class="departure-board"><small>今日のおすすめ</small><strong>かんたんクイズ</strong><span>全10問・約5分</span></div>
        <button class="photo-credit-link" data-view="credits">写真について</button>
      </div>
    </section>

    ${savedSession ? `<section class="resume-banner"><div><small>つづきがあります</small><strong>${savedSession.label || (savedSession.mode === 'review' ? '復習モード' : difficultyLabels[savedSession.difficulty]?.label)}・${savedSession.currentIndex + 1}問目</strong></div><button id="resume-session">つづきから</button><button id="discard-session" class="text-button">最初から</button></section>` : ''}

    <section class="home-missions" aria-label="今日のチャレンジと学習パスポート">
      <article class="daily-card ${dailyDone ? 'is-complete' : ''}">
        <div class="mission-icon" aria-hidden="true">${dailyDone ? '✓' : '3'}</div>
        <div><p>DAILY EXPRESS ／ ${dateKey.replaceAll('-', '.')}</p><h2>${dailyDone ? '今日の3問 クリア！' : '今日の3問'}</h2><span>${dailyDone ? `${progress.daily.streak}日連続乗車中。明日も新しい3問が届きます。` : 'かんたん・ふつう・むずかしいから1問ずつ。約2分で遊べます。'}</span></div>
        <button id="start-daily">${dailyDone ? 'もう一度あそぶ' : '今日の列車に乗る'} <span>→</span></button>
      </article>
      <article class="passport-card">
        <div class="passport-top"><div><small>TRAIN PASSPORT</small><strong>LV.${rank.level} ${rank.name}</strong></div><span>${progress.xp} XP</span></div>
        <div class="rank-progress" role="progressbar" aria-label="次のレベルまで" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${rank.value}"><i style="width:${rank.value}%"></i></div>
        <div class="passport-stats"><span>発見 <b>${learned}/${trains.length}</b></span><span>マスター <b>${mastered}/${trains.length}</b></span><span>連続乗車 <b>${progress.daily.streak}日</b></span></div>
      </article>
      <article class="recommend-card">
        <p>${nextAction.eyebrow}</p><h2>${nextAction.title}</h2><span>${nextAction.note}</span>
        <button data-recommend="${nextAction.action}">おすすめを始める →</button>
      </article>
    </section>

    <section class="level-section" aria-labelledby="level-title">
      <div class="section-heading"><div><p>3つの路線からえらぼう</p><h2 id="level-title">どのコースに乗る？</h2></div><span>各コース10問・同じ問題は出ません</span></div>
      <div class="quiz-format-guide" aria-label="出題ルール">
        <span>出題ルール</span>
        <p><strong>新幹線・特急</strong><small>E5系 はやぶさ、小田急50000形 VSEなど</small>形式＋愛称を当てる</p>
        <p><strong>通勤電車・地下鉄</strong><small>山手線、中央線快速、半蔵門線など</small>主に走る路線を当てる</p>
      </div>
      <div class="difficulty-list">${difficultyCards}</div>
    </section>

    <section class="theme-section" aria-labelledby="theme-title">
      <div class="section-heading"><div><p>好きからはじめるミニクイズ</p><h2 id="theme-title">テーマで遊ぶ</h2></div><span>5問だけのショートコース</span></div>
      <div class="theme-grid">${Object.entries(themeCourses).map(([key, course]) => `
        <button class="theme-card" data-theme="${key}">
          <span aria-hidden="true">${course.icon}</span><div><strong>${course.label}</strong><small>${course.note}</small></div><b>5問 →</b>
        </button>`).join('')}</div>
    </section>

    <section class="home-grid">
      <article class="review-panel">
        <p class="panel-kicker">もう一度見れば、きっと分かる</p><h2>まちがえた電車に<br>リベンジしよう！</h2>
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
        <div><p class="panel-kicker">見つけた電車をコレクション</p><h2>${trains.length}種類の電車ずかん</h2><p>新幹線から地方私鉄まで、見分け方と豆知識を収録。</p><button data-view="collection">ずかんを見にいく →</button></div>
        <div class="mini-line-map" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      </article>
    </section>
  `, 'home-page')

  document.querySelectorAll('[data-start]').forEach((button) => button.addEventListener('click', () => startQuiz(button.dataset.start)))
  document.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => startTheme(button.dataset.theme)))
  document.querySelector('#start-daily')?.addEventListener('click', startDaily)
  document.querySelector('[data-recommend]')?.addEventListener('click', (event) => {
    if (event.currentTarget.dataset.recommend === 'review') startReview(3)
    else startQuiz(event.currentTarget.dataset.recommend)
  })
  document.querySelector('#start-review')?.addEventListener('click', () => startReview())
  document.querySelector('#resume-session')?.addEventListener('click', () => {
    session = loadSession()
    view = 'quiz'
    window.scrollTo({ top: 0, behavior: 'auto' })
    renderQuiz()
  })
  document.querySelector('#discard-session')?.addEventListener('click', () => {
    clearSession()
    renderHome()
  })
}

const beginQuiz = ({
  mode = 'regular', difficulty = 'mixed', label, count = 10, trainIds = [], reviewIds = [],
  exactReview = false, seed = Date.now(), dailyKey = null, themeKey = null,
}) => {
  const questions = buildQuestionSet(trains, difficulty, { seed, count, trainIds, reviewIds, exactReview })
  session = {
    id: `${mode}-${Date.now()}`, mode, difficulty, label, questions, currentIndex: 0, answers: [], score: 0,
    streak: 0, maxStreak: 0, hintsUsed: 0, revealedHints: 0, locked: false, selectedAnswer: null,
    startedAt: Date.now(), questionStartedAt: Date.now(), dailyKey, themeKey,
    sourceTrainIds: trainIds, sourceReviewIds: reviewIds, exactReview,
  }
  saveSession(session)
  playSound('start', progress.soundOn)
  view = 'quiz'
  window.scrollTo({ top: 0, behavior: 'auto' })
  renderQuiz()
}

const startQuiz = (difficulty) => beginQuiz({
  mode: 'regular', difficulty, label: difficultyLabels[difficulty].label, count: 10,
})

const startDaily = () => {
  const dailyKey = todayKey()
  beginQuiz({
    mode: 'daily', difficulty: 'mixed', label: '今日の3問', count: 3,
    trainIds: dailyQuestionIds(trains, dailyKey), seed: Number(dailyKey.replaceAll('-', '')), dailyKey,
  })
}

const startTheme = (themeKey) => {
  const course = themeCourses[themeKey]
  if (!course) return
  beginQuiz({
    mode: 'theme', difficulty: 'mixed', label: course.label, count: 5,
    trainIds: course.ids, themeKey,
  })
}

const startReview = (limit = 10, ids = null) => {
  const reviewIds = (ids ?? selectReviewIds(progress, trains, limit)).slice(0, limit)
  if (!reviewIds.length) return
  beginQuiz({
    mode: 'review', difficulty: 'review', label: '苦手だけ復習', count: reviewIds.length,
    reviewIds, exactReview: true,
  })
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
      <div><span>${session.label || difficultyLabels[session.difficulty]?.label || 'ミックス'}</span><strong>${session.currentIndex + 1}<small> / ${session.questions.length}</small></strong></div>
      <div class="score-board"><span>SCORE <b>${session.score}</b></span><span>れんぞく <b>${session.streak}</b></span></div>
    </section>
    <div class="quiz-progress" role="progressbar" aria-label="クイズの進み具合" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progressWidth)}"><i style="width:${progressWidth}%"></i></div>
    <section class="quiz-layout">
      <div class="quiz-photo-column">
        <div class="photo-stage">
          ${trainImage(train, 'quiz-image', true, answered ? `${train.name}の実車写真` : '問題の電車の実車写真')}
          <button class="zoom-button" id="zoom-image" aria-label="電車の画像を拡大する">＋ 拡大</button>
          <span class="photo-status">実車写真</span>
        </div>
        <div class="observation-tip"><span>観察ナビ</span><div class="observation-steps" aria-label="見る順番"><i>1 先頭</i><i>2 色</i><i>3 ライト</i><i>4 窓</i></div><p>ひとつずつ比べると、色が似ていても見分けられます。</p></div>
      </div>
      <div class="question-column">
        <p class="question-type">QUESTION ${String(session.currentIndex + 1).padStart(2, '0')} ／ ${question.type === 'line' ? '路線を当てる' : '形式＋愛称を当てる'}</p>
        <h1 tabindex="-1">${QUESTION_LABELS[question.type]}</h1>
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
  document.querySelector('#zoom-image')?.addEventListener('click', () => openImageDialog(train, answered))
  document.querySelector('#bookmark-train')?.addEventListener('click', () => {
    const saved = new Set(progress.bookmarkedIds)
    if (saved.has(train.id)) saved.delete(train.id)
    else saved.add(train.id)
    progress.bookmarkedIds = [...saved]
    saveProgress(progress)
    renderQuiz()
  })
  preloadNextImage()
}

const feedbackPanel = (train, answer, correctAnswer) => {
  const title = answer.correct ? '正解！ よく見分けました' : `おしい！ 正解は「${correctAnswer}」`
  const selectedTrain = answer.correct ? null : trains.find((candidate) => answerFor(candidate, answer.type) === answer.selectedAnswer)
  const bookmarked = progress.bookmarkedIds.includes(train.id)
  const comparison = selectedTrain ? `
    <section class="compare-panel" aria-labelledby="compare-title">
      <div class="compare-heading"><small>COMPARE</small><h3 id="compare-title">選んだ電車と、ここが違う</h3></div>
      <div class="compare-grid">
        <article class="compare-card is-selected">${trainImage(selectedTrain)}<div><small>えらんだ答え</small><strong>${escapeHtml(answer.selectedAnswer)}</strong><p>${escapeHtml(selectedTrain.distinguishingPoints[0])}</p></div></article>
        <span class="compare-vs" aria-hidden="true">VS</span>
        <article class="compare-card is-correct">${trainImage(train)}<div><small>せいかい</small><strong>${escapeHtml(correctAnswer)}</strong><p>${escapeHtml(train.distinguishingPoints[0])}</p></div></article>
      </div>
    </section>` : ''
  return `<section class="answer-feedback ${answer.correct ? 'is-correct' : 'is-wrong'}" aria-live="polite">
    <div class="feedback-result"><span>${answer.correct ? '○' : '△'}</span><div><small>${answer.correct ? `+${answer.points} POINTS` : 'OBSERVATION CHANCE'}</small><h2 tabindex="-1" id="feedback-title">${escapeHtml(title)}</h2><p>${escapeHtml(train.name)} ／ ${escapeHtml(train.operator)}</p></div><button class="bookmark-button ${bookmarked ? 'is-saved' : ''}" id="bookmark-train" aria-pressed="${bookmarked}">${bookmarked ? '★ 復習リストに保存済み' : '☆ あとで復習'}</button></div>
    ${comparison}
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
  requestAnimationFrame(() => document.querySelector('#feedback-title')?.focus({ preventScroll: true }))
}

const nextQuestion = () => {
  if (session.currentIndex === session.questions.length - 1) return finishQuiz()
  session.currentIndex += 1
  session.revealedHints = 0
  session.locked = false
  session.selectedAnswer = null
  session.questionStartedAt = Date.now()
  saveSession(session)
  window.scrollTo({ top: 0, behavior: 'auto' })
  renderQuiz()
  requestAnimationFrame(() => document.querySelector('.question-column h1')?.focus?.({ preventScroll: true }))
}

const finishQuiz = () => {
  const xpBefore = progress.xp
  progress = applyCompletedSession(progress, session)
  newlyUnlocked = syncAchievements(progress)
  saveProgress(progress)
  clearSession()
  completedSession = structuredClone(session)
  completedSession.xpEarned = progress.xp - xpBefore
  playSound('finish', progress.soundOn)
  view = 'result'
  renderResult()
}

const renderResult = () => {
  if (!completedSession) return renderHome()
  const summary = sessionSummary(completedSession)
  const wrongTrains = summary.wrongIds.map(trainById)
  const rank = rankForXp(progress.xp)
  const unlockedItems = newlyUnlocked.map((id) => achievementCatalog.find((item) => item.id === id)).filter(Boolean)
  shell(`
    <section class="result-hero">
      <p class="route-label"><span>終点</span><b>▶</b><span>結果発表</span></p>
      <span class="result-emblem">${summary.correct}/${summary.total}</span>
      <p class="result-kicker">${completedSession.label || 'クイズ'} ／ あなたの称号</p><h1>${summary.title}</h1>
      <p>${summary.rate >= 70 ? '細かな違いまで、よく観察できました。' : 'まちがいは発見のチャンス。見分け方を覚えて次へ進もう。'}</p>
      ${completedSession.mode === 'daily' ? `<div class="daily-complete">今日の3問クリア <b>${progress.daily.streak}日連続</b></div>` : ''}
    </section>
    <section class="result-metrics">
      <div><small>SCORE</small><strong>${completedSession.score}</strong><span>ポイント</span></div>
      <div><small>ACCURACY</small><strong>${summary.rate}<i>%</i></strong><span>${summary.correct} / ${summary.total}問</span></div>
      <div><small>MAX STREAK</small><strong>${completedSession.maxStreak}</strong><span>最大連続正解</span></div>
      <div><small>HINTS</small><strong>${completedSession.hintsUsed}</strong><span>使用回数</span></div>
      <div><small>AVG. TIME</small><strong>${summary.averageSeconds.toFixed(1)}<i>秒</i></strong><span>1問あたり</span></div>
      <div class="xp-metric"><small>GET XP</small><strong>+${completedSession.xpEarned}</strong><span>LV.${rank.level} ${rank.name}</span></div>
    </section>
    ${unlockedItems.length ? `<section class="achievement-unlocked"><p>NEW BADGE</p><h2>新しいバッジを獲得！</h2><div>${unlockedItems.map((item) => `<article><span>${item.icon}</span><strong>${item.name}</strong><small>${item.note}</small></article>`).join('')}</div></section>` : ''}
    <section class="wrong-review">
      <div class="section-heading"><div><p>REVIEW YOUR ANSWERS</p><h2>${wrongTrains.length ? 'まちがえた電車' : '全問正解です'}</h2></div><span>${wrongTrains.length ? '正解との違いをもう一度確認しよう' : 'すばらしい観察力です'}</span></div>
      ${wrongTrains.length ? `<div class="wrong-list">${wrongTrains.map((train) => `<article>${trainImage(train)}<div><strong>${escapeHtml(train.name)}</strong><p>${escapeHtml(train.distinguishingPoints.join(' ／ '))}</p></div></article>`).join('')}</div>` : '<div class="perfect-message">図鑑で習熟度を確認して、次のコースへ進んでみよう。</div>'}
    </section>
    <section class="result-actions">
      <button class="primary-action" id="retry-same">同じコースでもう一度 <span>→</span></button>
      <button data-view="home">別のコースをえらぶ</button>
      <button id="review-wrong" ${wrongTrains.length ? '' : 'disabled'}>まちがえた問題だけ復習</button>
      <button data-view="collection">図鑑で習熟度を見る</button>
    </section>
  `, 'result-page')
  document.querySelector('#retry-same')?.addEventListener('click', replayCompletedSession)
  document.querySelector('#review-wrong')?.addEventListener('click', () => startReview(summary.wrongIds.length, summary.wrongIds))
}

const replayCompletedSession = () => {
  if (!completedSession) return
  if (completedSession.mode === 'regular') return startQuiz(completedSession.difficulty)
  if (completedSession.mode === 'daily') return startDaily()
  if (completedSession.mode === 'theme') return startTheme(completedSession.themeKey)
  if (completedSession.mode === 'review') return startReview(completedSession.sourceReviewIds.length, completedSession.sourceReviewIds)
}
const renderCollection = () => {
  const categories = [...new Set(trains.map((train) => train.category))]
  const regions = [...new Set(trains.map((train) => train.region))]
  const query = collectionFilters.query.trim().toLowerCase()
  const filtered = trains.filter((train) => {
    const stats = progress.trainStats[train.id] ?? { correct: 0, wrong: 0 }
    const mastery = masteryLevel(stats)
    const haystack = [train.name, train.reading, train.operator, ...train.mainLines].join(' ').toLowerCase()
    const matchesStatus = collectionFilters.status === 'all'
      || (collectionFilters.status === 'cleared' && stats.correct > 0)
      || (collectionFilters.status === 'locked' && stats.correct === 0)
      || (collectionFilters.status === 'mastered' && mastery === 3)
      || (collectionFilters.status === 'saved' && progress.bookmarkedIds.includes(train.id))
    return (!query || haystack.includes(query))
      && (collectionFilters.category === 'all' || train.category === collectionFilters.category)
      && (collectionFilters.region === 'all' || train.region === collectionFilters.region)
      && (collectionFilters.difficulty === 'all' || train.difficulty === collectionFilters.difficulty)
      && matchesStatus
  })
  shell(`
    <section class="page-intro"><p class="route-label"><span>LIBRARY</span><b>▶</b><span>${trains.length} TRAINS</span></p><h1>電車図鑑</h1><p>写真と観察ポイントを見比べて、3段階の習熟度を上げよう。</p></section>
    <section class="collection-toolbar" aria-label="図鑑の絞り込み">
      <label class="search-filter">検索<input data-filter="query" type="search" value="${escapeHtml(collectionFilters.query)}" placeholder="名前・会社・路線"></label>
      <label>種類<select data-filter="category"><option value="all">すべて</option>${categories.map((value) => `<option ${collectionFilters.category === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>
      <label>地域<select data-filter="region"><option value="all">すべて</option>${regions.map((value) => `<option ${collectionFilters.region === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>
      <label>難易度<select data-filter="difficulty"><option value="all">すべて</option>${Object.entries(difficultyLabels).map(([key, item]) => `<option value="${key}" ${collectionFilters.difficulty === key ? 'selected' : ''}>${item.label}</option>`).join('')}</select></label>
      <label>記録<select data-filter="status"><option value="all">すべて</option><option value="cleared" ${collectionFilters.status === 'cleared' ? 'selected' : ''}>正解済み</option><option value="mastered" ${collectionFilters.status === 'mastered' ? 'selected' : ''}>マスター</option><option value="saved" ${collectionFilters.status === 'saved' ? 'selected' : ''}>復習リスト</option><option value="locked" ${collectionFilters.status === 'locked' ? 'selected' : ''}>未正解</option></select></label>
      <label class="silhouette-switch"><input type="checkbox" id="silhouette-toggle" ${progress.silhouetteLocked ? 'checked' : ''}> 未正解をシルエット表示</label>
      <strong>${filtered.length}<small> / ${trains.length}種類</small></strong>
    </section>
    <section class="train-grid">${filtered.map(collectionCard).join('')}</section>
  `, 'collection-page')
  document.querySelectorAll('[data-filter]').forEach((control) => control.addEventListener('change', () => {
    collectionFilters[control.dataset.filter] = control.value
    renderCollection()
  }))
  document.querySelectorAll('[data-bookmark]').forEach((button) => button.addEventListener('click', () => {
    const saved = new Set(progress.bookmarkedIds)
    if (saved.has(button.dataset.bookmark)) saved.delete(button.dataset.bookmark)
    else saved.add(button.dataset.bookmark)
    progress.bookmarkedIds = [...saved]
    saveProgress(progress)
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
  const mastery = masteryLevel(stats)
  const winsToNextMastery = (() => {
    if (mastery === 3) return 0
    for (let wins = 1; wins <= 12; wins += 1) {
      if (masteryLevel({ correct: stats.correct + wins, wrong: stats.wrong }) > mastery) return wins
    }
    return 1
  })()
  const hidden = progress.silhouetteLocked && stats.correct === 0
  const bookmarked = progress.bookmarkedIds.includes(train.id)
  return `<article class="train-card ${hidden ? 'silhouette' : ''}">
    <div class="card-photo">${trainImage(train)}<span>${difficultyLabels[train.difficulty].label}</span><button class="card-bookmark ${bookmarked ? 'is-saved' : ''}" data-bookmark="${train.id}" aria-label="${escapeHtml(train.name)}を復習リスト${bookmarked ? 'から外す' : 'に保存'}" aria-pressed="${bookmarked}">${bookmarked ? '★' : '☆'}</button></div>
    <div class="card-body"><div class="card-meta"><small>${escapeHtml(train.category)} ／ ${escapeHtml(train.operator)}</small><span>習熟度 ${masteryDots(mastery)}</span></div><h2>${hidden ? '？？？' : escapeHtml(train.name)}</h2><p class="reading">${hidden ? 'クイズで正解すると表示されます' : escapeHtml(train.reading)}</p>
      <dl><div><dt>形式</dt><dd>${hidden ? '—' : escapeHtml(train.series)}</dd></div><div><dt>主な路線</dt><dd>${hidden ? '—' : escapeHtml(train.mainLines.join('・'))}</dd></div><div><dt>登場年</dt><dd>${hidden ? '—' : `${train.introducedYear}年`}</dd></div><div><dt>最高速度</dt><dd>${hidden ? '—' : escapeHtml(train.maxSpeed)}</dd></div></dl>
      <div class="record-strip"><span>正解 <b>${stats.correct}</b></span><span>まちがい <b>${stats.wrong}</b></span><span>${mastery === 3 ? 'マスター！' : `あと${winsToNextMastery}回正解で成長`}</span></div>
      ${hidden ? '' : `<details><summary>見分け方と豆知識</summary><h3>見分け方</h3><ul>${train.distinguishingPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul><h3>豆知識</h3><p>${escapeHtml(train.trivia)}</p></details>`}
    </div>
  </article>`
}
const renderStats = () => {
  const totalRate = progress.totalQuestions ? Math.round((progress.totalCorrect / progress.totalQuestions) * 100) : 0
  const reviewIds = [...new Set([...progress.bookmarkedIds, ...selectReviewIds(progress, trains, 10)])].slice(0, 8)
  const weak = reviewIds.map(trainById).filter(Boolean)
  const learned = trains.filter((train) => (progress.trainStats[train.id]?.correct ?? 0) > 0).length
  const mastered = trains.filter((train) => masteryLevel(progress.trainStats[train.id]) === 3).length
  const rank = rankProgress()
  shell(`
    <section class="page-intro"><p class="route-label"><span>RECORD</span><b>▶</b><span>YOUR JOURNEY</span></p><h1>電車パスポート</h1><p>点数だけでなく、発見・習熟度・バッジで成長を確認できます。</p></section>
    <section class="passport-hero">
      <div class="passport-level"><span>LV.${rank.level}</span><div><small>CURRENT RANK</small><h2>${rank.name}</h2><p>${progress.xp} XP ${rank.next ? `／ 次のレベルまで ${rank.next - progress.xp} XP` : '／ 最高ランク達成！'}</p></div></div>
      <div class="rank-progress large" role="progressbar" aria-label="次のレベルまで" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${rank.value}"><i style="width:${rank.value}%"></i></div>
      <div class="passport-summary"><span>発見した電車 <b>${learned}/${trains.length}</b></span><span>マスターした電車 <b>${mastered}/${trains.length}</b></span><span>今日の3問 <b>${progress.daily.streak}日連続</b></span><span>バッジ <b>${progress.achievements.length}/${achievementCatalog.length}</b></span></div>
    </section>
    <section class="stats-board">
      <div><small>PLAY COUNT</small><strong>${progress.plays}</strong><span>プレイ回数</span></div>
      <div><small>TOTAL ACCURACY</small><strong>${totalRate}<i>%</i></strong><span>${progress.totalCorrect} / ${progress.totalQuestions}問</span></div>
      <div><small>BEST STREAK</small><strong>${progress.maxStreak}</strong><span>最大連続正解</span></div>
      <div><small>DISCOVERED</small><strong>${learned}<i>/${trains.length}</i></strong><span>正解した電車</span></div>
      <div><small>MASTERED</small><strong>${mastered}<i>/${trains.length}</i></strong><span>習熟度3</span></div>
    </section>
    <section class="course-records"><div class="section-heading"><div><p>COURSE RECORDS</p><h2>難易度別ベストスコア</h2></div><span>満点 1,000ポイント</span></div><div>${Object.entries(difficultyLabels).map(([key, item], index) => `<article style="--level-color:${item.color}"><span>0${index + 1}</span><div><small>${item.label}</small><strong>${progress.bestScores[key]}<i> pt</i></strong></div><progress max="1000" value="${progress.bestScores[key]}"></progress></article>`).join('')}</div></section>
    <section class="badge-section"><div class="section-heading"><div><p>ACHIEVEMENTS</p><h2>コレクションバッジ</h2></div><span>${progress.achievements.length} / ${achievementCatalog.length} 獲得</span></div><div class="badge-grid">${achievementCatalog.map((item) => { const earned = progress.achievements.includes(item.id); return `<article class="${earned ? 'is-earned' : 'is-locked'}"><span>${earned ? item.icon : '?'}</span><strong>${item.name}</strong><small>${item.note}</small></article>` }).join('')}</div></section>
    <section class="weak-section"><div class="section-heading"><div><p>SMART REVIEW</p><h2>あなた専用の復習リスト</h2></div><span>保存した電車＋まちがい率が高い順</span></div>${weak.length ? `<div class="weak-list">${weak.map((train) => { const stats = progress.trainStats[train.id] ?? { correct: 0, wrong: 0 }; return `<article>${trainImage(train)}<div><strong>${escapeHtml(train.name)}</strong><span>正解 ${stats.correct} ／ まちがい ${stats.wrong}</span>${masteryDots(masteryLevel(stats))}</div></article>` }).join('')}</div><button class="primary-action" id="stats-review">この電車だけ復習する <span>→</span></button>` : '<div class="empty-state">まちがえた電車や「あとで復習」に保存した電車が、ここに表示されます。</div>'}</section>
    <section class="data-settings"><div><small>LAST PLAYED</small><strong>${formatDate(progress.lastPlayedAt)}</strong></div><button id="reset-data">すべての成績を消去</button></section>
  `, 'stats-page')
  document.querySelector('#stats-review')?.addEventListener('click', () => startReview(reviewIds.length, reviewIds))
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
    <section class="page-intro"><p class="route-label"><span>GUIDE</span><b>▶</b><span>OBSERVE & GROW</span></p><h1>遊び方</h1><p>正解するだけでなく、「どこを見たら分かるか」を自分の力にするクイズです。</p></section>
    <section class="howto-steps">
      <article><span>01</span><div><small>OBSERVE</small><h2>4か所を順番に観察</h2><p>先頭・色・ライト・窓の順番で見ます。問題中の名前は写真の読み上げにも表示されないので、じっくり考えられます。</p></div></article>
      <article><span>02</span><div><small>ANSWER</small><h2>4つから答える</h2><p>タッチ・クリック・数字キーに対応。分からないときは3段階のヒントを使えます。</p></div></article>
      <article><span>03</span><div><small>COMPARE</small><h2>まちがいを見比べる</h2><p>選んだ電車と正解を写真で並べて、色や先頭形状の違いをその場で確認します。</p></div></article>
      <article><span>04</span><div><small>GROW</small><h2>習熟度とバッジを育てる</h2><p>正解を重ねると習熟度が3段階で上がります。XP、称号、毎日の連続記録も電車パスポートに保存されます。</p></div></article>
    </section>
    <section class="feature-guide"><article><strong>今日の3問</strong><p>3つの難易度から1問ずつ。毎日約2分で続けられます。</p></article><article><strong>テーマ別5問</strong><p>新幹線・特急・路線当てから好きな分野を選べます。</p></article><article><strong>スマート復習</strong><p>まちがえた電車と保存した電車だけを出題します。</p></article></section>
    <section class="score-guide"><h2>ヒントと点数</h2><div><span>ヒントなし <b>100点</b></span><span>1回 <b>80点</b></span><span>2回 <b>60点</b></span><span>3回 <b>40点</b></span></div></section>
    <button class="primary-action centered" data-view="home">ホームへ戻る <span>→</span></button>
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

const openImageDialog = (train, revealName = true) => {
  const dialog = document.querySelector('#image-dialog')
  const altText = revealName ? `${train.name}の実車写真` : '問題の電車の拡大写真'
  document.querySelector('#dialog-image').innerHTML = `${trainImage(train, '', true, altText)}${revealName ? `<p>${escapeHtml(train.name)}</p>` : '<p>写真を拡大しています。先頭・色・ライト・窓を観察しよう。</p>'}`
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
  requestAnimationFrame(() => document.querySelector('#main-content')?.focus({ preventScroll: true }))
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
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}
