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

## AIST 3DDB公開版から元データZIPを検索する

地図上の地点を **右クリック**（タッチ端末では長押し）→「AIST 3DDB：元データZIPを検索」を選択します。
経度・緯度（WGS84）を3DDB公開APIの `area=POINT(lon lat)` に渡し、該当する登録データを表示します。

- `downloadable: true` の登録データだけ、ユーザーが「元データZIPを取得」を押してダウンロードページを開けます。クリックした点だけを切り出すのではなく **登録データ一式** のZIPです。
- 検索API: `GET https://gsvrg.ipri.aist.go.jp/3ddb_demo/api/v1/services/ALL/features`（公式文書の `gsrt.digiarc.aist.go.jp` は301先。**ブラウザのCORS fetchは別オリジン301を追えない**ため、クライアントは最終ホストを直接指定）
- ZIP API: `GET …/api/v1/zipdata/{reg_id}`（リンク遷移。本体は `fetch` しない）
- 検索件数は初期最大100件（API総件数が多い場合は画面に注意表示）。
- 検索結果表示後、ZIPエンドポイントへ軽量疎通（HEAD等）を行い、HTTPエラー理由を画面に出します。
- 公開版検索のCORSは `Access-Control-Allow-Origin: *` を実測済み（2026-10-31）。失敗時はエラーと検索URL確認リンクを表示します。
- 公開版のテストと内部版の切替は別段階です。内部版の認証方式・CORS・APIパス・配信権限が確認できるまでは内部URLを設定しません。
- 静的地図には認証Cookie、APIトークン、内部版のホスト名を埋め込まないでください。

公開API仕様: https://github.com/aistairc/aist_3ddb_client#3ddb-api

実APIスモーク（venv）: `python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements-aist-probe.txt && .venv/bin/python scripts/probe_aist_3ddb_public.py`

### 手動受入確認

1. 地図から右クリック→AIST 3DDB検索を開き、検索結果・ZIP取得可否の表示を確認します。
2. 湯沢市の対象地点で公開データが0件なら、産総研つくばセンター付近（経度 140.135, 緯度 36.062）でも同様に確認します。
3. ZIP疎通が成功した場合のみ、リンクからファイルを取得し、ZIPとして開けること・エントリ一覧を確認します。疎通が HTTP 404 のときはサーバ側ブロッカーとして記録し、合格扱いにしません。
4. ブラウザのNetwork/ConsoleにCORS/401/403等のエラーがないかを記録します。
5. 公開版ZIP取得の実機確認が完了するまで、内部版の接続先切替は進めません。

### 内部版（将来・別PR）

公開版で検索と実ZIP取得が証拠付きで通るまで着手しません。内部版URL・Cookie・トークンは本リポジトリに入れません。接続方式は「Pages直叩き / 同一オリジン配備 / 組織承認済み認証」を比較し、認証の迂回は行いません。
