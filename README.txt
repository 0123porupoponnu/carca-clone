CARCA CLONE 配置テスト v1

1. GitHubリポジトリ carca-clone のルートに placement-test.html を追加
2. tile-master.json と images/ は既存のものがv4.2ならそのまま利用可能
3. 公開後 https://0123porupoponnu.github.io/carca-clone/placement-test.html を開く

ZIPには必要なJSONと画像24種類を同梱（既存と同じv4.2）。
すでに配置済みなら placement-test.html だけアップロードでOK。
index.html は上書きしないでください。

判定範囲：4辺のcity/road/field一致、盤面隣接、90度回転、盤面への配置、取り消し。
対象外：草原の内部連結、ミープル、山札消費、得点、CPU、盤面の無限拡張。
実際の元画像とv4.2の辺定義は暫定のため、ここで違いを見つけて修正します。
