# yuzawa-map-pages

湯沢市向け Web 地図の静的ファイルです。
[`yuzawa-map-pages`](https://github.com/Yoshida088603/yuzawa-map-pages)
へ push して GitHub Pages で公開できます。機密メモ・写真は [ACCESS.md](./ACCESS.md) のガード配下を推奨します。

## 試験公開 URL

`https://yoshida088603.github.io/yuzawa-map-pages/`

## ローカル確認（Windows）

PMTiles は HTTP Range が必要なため、`python -m http.server` ではなく同梱の `serve.py` を使う。

```powershell
cd yuzawa-map-pages
python .\serve.py --port 8787
```

ブラウザで `http://127.0.0.1:8787/` を開く（iPhone 実機は同一 LAN の PC IP でも可）。

## 追加機能（概要）

- GPS 現在地（右下ボタン。長押しで短時間追従）
- 地点メモの端末ローカル編集・写真・書き出し（Pages には直接書けない）
- Service Worker による L1 オフライン（殻・メモ・レーザ・森林輪郭。背景タイルはオンライン必須）
- 字・町丁界レイヤ（既定 OFF）
- 平面直角第10系（EPSG:6678）座標コピー

詳細な同期・ガードは [SYNC.md](./SYNC.md) / [ACCESS.md](./ACCESS.md)。

## メモ書き出しのマージ（Windows / venv）

```powershell
cd yuzawa-map-pages
.\.venv-scripts\Scripts\python.exe -m venv .venv-scripts   # 初回のみ
.\.venv-scripts\Scripts\python.exe scripts\merge_memo_bundle.py path\to\yuzawa-memo-bundle-....json
# 写真もリポに載せる場合（Access 配下のみ）:
.\.venv-scripts\Scripts\python.exe scripts\merge_memo_bundle.py path\to\bundle.json --photos
```

## 境界データ再生成

```powershell
.\.venv-scripts\Scripts\python.exe scripts\build_boundaries.py
```

## 公開前チェック

- [ ] `data/shinrin/` を Pages に載せてよいか確認した
- [ ] tippecanoe 再生成は公開リポでは行っていない（成果物コピーのみ）
- [ ] `data/laser/` の出典表記がシートにある
- [ ] 地点メモ `data/memos.geojson` の内容を公開して問題ない
- [ ] 現地写真・詳細メモを載せるなら Access 配下か、端末のみか確認した（[ACCESS.md](./ACCESS.md)）
- [ ] `data/boundaries/` の出典・公開可否を確認した

## データ

| パス | 内容 |
|---|---|
| `data/manifest.json` | バージョンとファイル一覧（`?v=` 用） |
| `data/memos.geojson` | 地点メモ FeatureCollection（安定 id） |
| `data/laser/` | 航空レーザ計測範囲（年度色分け） |
| `data/shinrin/shinrin.geojson` | 森林区分輪郭 |
| `data/shinrin/shinrin-parcels.pmtiles` | 筆界ベクトルタイル |
| `data/boundaries/boundaries.geojson` | 字・町丁界（簡略線＋ラベル） |
| `data/memo-photos/` | マージ後の写真（任意・ガード推奨） |
| `sw.js` | L1 オフライン用 Service Worker |
| `vendor/pmtiles/` | PMTiles クライアント |

## ステージングとの関係

作業用ステージングが `yuzawa_NInI_henkan/public` の場合:

```powershell
robocopy ..\yuzawa_NInI_henkan\public . /E /XD .git .venv-scripts
```

本フォルダを正とする場合は逆方向に揃える。

## ライセンス

コードは [MIT](./LICENSE)。データは出典元の利用条件に従い、公開範囲は都度確認します。
