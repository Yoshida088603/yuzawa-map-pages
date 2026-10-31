# yuzawa-map-pages（ステージング: public/）

湯沢市向け Web 地図の **試験公開用** 静的ファイルです。このフォルダの内容を
[`yuzawa-map-pages`](https://github.com/Yoshida088603/yuzawa-map-pages)
へ同期して GitHub Pages で公開します。

## 試験公開 URL

`https://yoshida088603.github.io/yuzawa-map-pages/`

## ローカル確認（Windows）

```powershell
cd yuzawa_NInI_henkan\public
python -m http.server 8787
```

ブラウザで `http://127.0.0.1:8787/` を開く（iPhone 実機は同一 LAN の PC IP でも可）。

## 同期例（PowerShell）

```powershell
cd ..\yuzawa-map-pages
# public/ の内容（index.html, app/, data/, vendor/, .nojekyll, LICENSE, README）を
# このリポジトリの作業ツリーへコピーして commit & push
robocopy ..\yuzawa_NInI_henkan\public . /E /XD .git
```

## 公開前チェック

- [ ] `data/shinrin/`（湯沢市森林区分図の dissolve）を Pages に載せてよいか確認した
- [ ] `data/laser/`（測技協レーザポータルの範囲）の出典表記がシートにある
- [ ] 地点メモ `data/memos.geojson` の内容を公開して問題ない

## データ

| パス | 内容 |
|---|---|
| `data/manifest.json` | バージョンとファイル一覧（`?v=` 用） |
| `data/memos.geojson` | 地点メモ FeatureCollection（安定 id） |
| `data/laser/` | 航空レーザ計測範囲（年度色分け） |
| `data/shinrin/` | 森林区分（区分 dissolve、約 1.7MB） |

## ライセンス

コードは [MIT](./LICENSE)。データは出典元の利用条件に従い、公開範囲は都度確認します。
