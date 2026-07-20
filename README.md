# でんしゃ、どれかな？

写真を見て日本の鉄道車両を当てる、子ども向けの学習クイズWebアプリです。30車種・3段階の難易度を収録し、ヒント、復習、図鑑、成績保存までブラウザだけで動作します。

## 主な機能

- かんたん・ふつう・むずかしい各10車種、全30車種
- 1回10問、4択、段階ヒント、連続正解、難易度別スコア
- 間違えた車両を優先する復習モード
- 車種・地域・難易度・正解状況で絞り込める車両図鑑
- 未正解車両をシルエットにする図鑑モード
- 最高記録、正答率、連続正解、学習履歴をLocalStorageに保存
- キーボード操作（1〜4）、効果音ON/OFF、画像拡大、レスポンシブ表示
- 画像クレジット画面と、オフライン配信できるローカルWebP画像

## 起動方法

Node.js 20.19以上（または22.12以上）を使用してください。

```bash
npm install
npm run dev
```

表示されたローカルURLをブラウザで開きます。

## 品質チェック

```bash
npm test
npm run build
npm run preview
```

テストでは車両数、難易度ごとの件数、出題重複、4択の一意性、採点、復習優先ロジックを検証します。

## 車両を追加する

1. `src/data/trains.js` に既存項目と同じ形式で車両データを追加します。
2. `scripts/image-manifest.json` に車両IDとWikimedia Commons検索語を追加します。
3. `python -m pip install -r scripts/requirements.txt` で画像ツールを準備します。
4. `python scripts/fetch_commons_images.py` を実行します。
5. 図鑑と「画像クレジット」で写真・作者・ライセンスを目視確認します。
6. `npm test` と `npm run build` を実行します。

写真取得スクリプトはCC BY系（CC BY-SAを含む）、CC0、Public Domainのみを候補にし、WebPを`public/images`へ保存して、`src/data/imageCredits.js`を生成します。検索結果は自動選択なので、追加時には必ず車両が正しいか人の目で確認してください。

## データと権利表記

- 各写真の作者・原典・ライセンス・加工有無はアプリ内の「画像クレジット」に表示します。
- 写真はWikimedia Commonsの各ファイルページに記載された条件に従います。
- 車両の登場年・最高速度・路線は、鉄道事業者の公式ページを優先して確認しています。確認先は[FACT_SOURCES.md](./FACT_SOURCES.md)にまとめています。
- 画像と車両情報は更新される可能性があるため、再利用・追加公開時にも原典を再確認してください。

## 構成

```text
src/data/trains.js        車両・ヒント・解説データ
src/data/imageCredits.js  画像権利情報（自動生成）
src/logic.js              出題・選択肢・採点ロジック
src/storage.js            LocalStorageと進行状況
src/main.js               画面とイベント
src/styles.css            UIとレスポンシブ設計
scripts/                  画像取得・変換ツール
```

## GitHub Pages

`main`ブランチへpushすると、`.github/workflows/deploy-pages.yml`がテストとビルドを行い、GitHub Pagesへ公開します。リポジトリの **Settings → Pages → Source** は **GitHub Actions** を選択してください。

## 技術

Vite / Vanilla JavaScript / CSS / Vitest。バックエンドやAPIキーは不要です。
