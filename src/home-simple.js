export const simpleHomeMarkup = ({
  trainCount,
  heroImage,
  savedSession,
  dailyDone,
  dailyStreak,
  dateKey,
  reviewCount,
  difficultyCards,
  themeCourses,
  rank,
  learned,
  mastered,
  totalRate,
}) => `
  <section class="home-hero home-hero-simple">
    <div class="hero-copy">
      <p class="hero-kicker"><span aria-hidden="true">●</span> ふりがなつき・${trainCount}しゅるい</p>
      <h1>どの電車か、<br><em>わかるかな？</em></h1>
      <p>写真をよく見て、電車の名前や走る路線を当てよう。</p>
      <button class="primary-action hero-action" data-start="easy">
        <span class="action-icon" aria-hidden="true">▶</span>
        <span class="action-copy"><small>まずはここから</small><strong>かんたん10問であそぶ</strong></span>
        <span class="action-arrow" aria-hidden="true">→</span>
      </button>
    </div>
    <div class="hero-photo">
      ${heroImage}
      <div class="departure-board"><small>START HERE</small><strong>かんたんクイズ</strong><span>10問</span></div>
      <button class="photo-credit-link" data-view="credits">写真について</button>
    </div>
  </section>

  ${savedSession ? `<section class="resume-banner home-resume"><div><small>つづきがあります</small><strong>${savedSession.label}・${savedSession.questionNumber}問目</strong></div><button id="resume-session">つづきから</button><button id="discard-session" class="text-button">最初から</button></section>` : ''}

  <section class="home-action-section" aria-labelledby="home-action-title">
    <div class="home-action-heading">
      <div><p>TODAY</p><h2 id="home-action-title">きょうは、どれであそぶ？</h2></div>
      <span>迷ったら「今日の3問」がおすすめ</span>
    </div>

    <div class="home-action-grid">
      <article class="home-action-card home-daily-card ${dailyDone ? 'is-complete' : ''}">
        <span class="home-action-icon" aria-hidden="true">${dailyDone ? '✓' : '3'}</span>
        <div><small>${dateKey.replaceAll('-', '.')} ／ 約2分</small><h3>${dailyDone ? '今日の3問 クリア！' : '今日の3問'}</h3><p>${dailyDone ? `${dailyStreak}日れんぞく。もう一度あそべるよ。` : '3つのレベルから、1問ずつ出るよ。'}</p></div>
        <button id="start-daily">${dailyDone ? 'もう一度' : 'あそぶ'} <span>→</span></button>
      </article>

      <article class="home-action-card home-review-card">
        <span class="home-action-icon" aria-hidden="true">↻</span>
        <div><small>おさらい</small><h3>${reviewCount ? `まちがえた電車 ${reviewCount}両` : '復習の準備はOK'}</h3><p>${reviewCount ? '苦手な電車だけ、もう一度。' : 'まちがえた電車がここに集まるよ。'}</p></div>
        ${reviewCount
    ? `<button id="start-review">復習する <span>→</span></button>`
    : '<button data-view="collection">ずかんを見る <span>→</span></button>'}
      </article>

      <article class="home-action-card home-library-card">
        <span class="home-action-icon" aria-hidden="true">▦</span>
        <div><small>${trainCount} TRAINS</small><h3>電車ずかん</h3><p>名前・路線・見分け方を見られるよ。</p></div>
        <button data-view="collection">ずかんへ <span>→</span></button>
      </article>
    </div>

    <details class="home-course-picker">
      <summary>
        <span class="course-summary-icon" aria-hidden="true">＋</span>
        <span><small>もっとあそぶ</small><strong>レベルやテーマをえらぶ</strong></span>
        <b>ひらく</b>
      </summary>
      <div class="home-course-body">
        <section>
          <div class="home-course-title"><h3>10問コース</h3><span>レベルをえらぶ</span></div>
          <div class="difficulty-list">${difficultyCards}</div>
        </section>
        <section>
          <div class="home-course-title"><h3>5問ミニクイズ</h3><span>好きなテーマだけ</span></div>
          <div class="theme-grid">${Object.entries(themeCourses).map(([key, course]) => `
            <button class="theme-card" data-theme="${key}">
              <span aria-hidden="true">${course.icon}</span><div><strong>${course.label}</strong><small>${course.note}</small></div><b>5問 →</b>
            </button>`).join('')}</div>
        </section>
      </div>
    </details>

    <nav class="home-compact-links" aria-label="ずかんと記録">
      <button data-view="stats"><span>LV.${rank.level}</span><strong>電車パスポート</strong><small>発見 ${learned}/${trainCount}・正解率 ${totalRate}%</small></button>
      <button data-view="collection"><span>${mastered}</span><strong>マスターした電車</strong><small>全${trainCount}種類のずかんを見る</small></button>
    </nav>
  </section>
`
