# CARCA CLONE v1.0.2 — 第1段階

既存のタイル画像・24種類のマスタ・画面を引き継いだ、2人対戦と通常CPU対戦に対応しています。2人対戦は同じ端末を交互に操作します。オンライン対戦ではありません。

## 最終得点の表示

対戦終了後は、対局中の得点・未完成都市・未完成道路・未完成修道院・草原・合計をそれぞれ1行にまとめます。青とオレンジを横に並べて比較できます。スマホでは結果を盤面の上に表示し、結果欄の内部スクロールをなくしています。得点計算のルールは変更していません。

## 通常CPUと対戦

画面の「相手」を「CPUと対戦」に変更し、新しい対局を開始してください。青がプレイヤー（先手）、オレンジがCPUです。CPUは固定の評価方法で得点やミープルの残数を見て手を選びます。保存した学習データは使いません。強さの選択はありません。CPUの手番中は自動で進み、操作ボタンは無効になります。再読込後もCPU対戦を再開します。

取り消しは、その画面を開いてからの履歴の範囲で、CPUの応答も含めてプレイヤーの操作まで戻ります。再読込前の取り消し履歴は保持しません。

## 遊び方

1. GitHub PagesのURLをスマホまたはiPadで開く。
2. 青が先手。現在のタイルを左右に回し、緑の「＋」に配置。
3. 都市・道路・修道院・草原を選び、置き場所を選んで「ここに置く」。不要なら「ミープルを置かずに次へ」。
4. 完成地形を自動採点し、農夫以外のミープルを回収。交互に繰り返す。
5. 山札終了時に未完成地形と草原を加算し、最終結果を表示。

盤面は1本指で移動、2本指で拡大縮小できます。ミープルは地形上に立ち、草原では横になります。「ひとつ戻す」は直前の配置またはミープル選択に戻ります。対局は操作のたび端末内に保存し、再読込後に再開します。保存にはブラウザのローカルストレージを使います。同じブラウザ・同じURLで利用してください。

## 実装ルール

- 基本セット72枚：開始アンダーバー1枚、山札71枚。19系統を紋章違いで24種類に分割。
- タイルは直交隣接が必要、接する全辺が一致、回転は90度単位。置けないタイルは自動除外して次を引く。
- その手に置いたタイルだけに、手持ちから1個まで配置。同じ連結地形に誰かのミープルがあれば配置不可。別地形からの合流による相乗りは可能。
- 都市：完成はタイルと紋章につき各2点、未完成は各1点。4辺都市も紋章1個。
- 道路：タイル1枚につき1点。交差点の各道路は独立し、閉ループも完成。
- 同一地形が同じタイルに複数回入ってもそのタイルは1回だけ数える。
- 修道院：自分のタイル＋周囲8マス。完成9点、終了時は存在する分。
- 草原：終了時のみ、接する完成都市につき3点。都市は同じ草原につき1回。農夫は途中回収なし。
- ミープル最多のプレイヤーが満額得点。同数なら双方が満額。
- 川・修道院長など拡張は対象外。画像に庭園があっても得点対象ではありません。

公式資料：
https://www.hans-im-glueck.de/en/game/carcassonne/
https://www.hans-im-glueck.de/wp-content/uploads/2024/11/Carcassonne-v3_Rulesheet_EN_web.pdf
https://www.hans-im-glueck.de/wp-content/uploads/2024/11/Carcassonne-v3_Supplement_EN_web.pdf

## 学習データ

「記録・学習」から名前別の対戦手保存、BGA URLメモ、JSON書き出し・読み込みができます。旧版の `carcaCloneUnifiedTrainingV1` をそのまま使用します。更新前にJSONを書き出すとバックアップになります。学習CPU・BGA棋譜の自動取得は第2段階です。通常CPUはv1.0.1で利用できます。

旧試作版の途中対局は、暫定ルールの得点を引き継がないため自動再開しません。v1.0で新しく対局してください。旧学習記録は残ります。

## 起動とテスト

GitHub Pages推奨。PCではファイル一式を同じフォルダに置き、`index.html` を直接開くこともできます。iOSの「ファイル」アプリのプレビューではなくSafariからPagesを開いてください。

```sh
python3 -m http.server 8000
# 別ターミナル
node --test tests/rules.test.cjs
```

ブラウザ内自動テスト： `http://localhost:8000/tests/browser-qa.html`

CPU対戦のテスト： `http://localhost:8000/tests/browser-qa.html?cpu=1`
スマホ390×844、iPad横1024×768、iPad縦768×1024のiframeで各71手を実行。テスト専用保存キーを使い、通常の学習・対局データは変更しません。

Playwrightで実際のクリックを行うテストも同梱：

```sh
npm install
npx playwright install chromium
npm run test:browser
```

既存のChromiumを使う場合は `CHROME_PATH=/usr/bin/chromium npm run test:browser`。
実施済みの結果と確認範囲は `VERIFICATION.txt` を参照してください。

## GitHubへの反映

手軽な方法：

1. 更新前にアプリの学習JSONを書き出す。
2. ZIPを展開し、GitHubの `0123porupoponnu/carca-clone` を開く。
3. `Add file` → `Upload files` で展開した中身をアップロードし、同じ名前のファイルを更新する。ZIP自体や外側のフォルダではなく、中のファイルを置く。
4. Commit changes。Pagesが公開元にしているブランチへ反映する。
5. Pagesの公開完了後にSafariで再読込し、見出し「第1段階 v1.0.2」を確認する。

Gitを使う方法：

```sh
git clone https://github.com/0123porupoponnu/carca-clone.git
cd carca-clone
git switch -c release/v1.0.1
# ZIPの中身をこのフォルダへ上書きコピー
node --test tests/rules.test.cjs
git add index.html rules.js cpu.js tile-master.json field-regions.csv README.md README.txt README-fix.txt VERIFICATION.txt package.json tests .gitignore
git commit -m "Add ordinary CPU opponent in Carca Clone v1.0.1"
git push -u origin release/v1.0.1
# GitHubで既定ブランチへのPull Requestを作り、マージ
```

今回リモートへのpush・マージは行っていません。既存の公開設定は維持してください。

## ファイル

- `index.html`：画面・対戦進行・保存。直接起動用のマスタも内蔵（テストで一致を検証）。
- `cpu.js`：通常CPUの固定評価・手番実行。
- `rules.js`：配置・連結・占有・採点の共有実装。
- `tile-master.json`：枚数・辺・内部接続・草原と都市の隣接・表示座標。
- `images/`：元画像を変更せず引き継ぎ。
- `tests/`：回帰テストとブラウザ動作テスト。
- 既存の `*-test.html`、`gallery.html` は旧開発用補助ページです。v1.0の検証は `tests/` を使います。
