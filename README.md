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
経度・緯度（WGS84）を3DDB公開APIの `area=POINT(lon lat)` に渡し、**該当する登録データを全件一覧**します（人が選ぶ）。

- **地図表示範囲のバウンディングボックス検索ではありません。** クリック点を含む登録データの被覆ポリゴンがヒットします。区全体の CITYGML など広域データも混ざるのはそのためです。
- 一覧は「取得URLあり → 被覆が小さい順」で並べ、各件に概算の被覆サイズを表示します。
- 取得URLは **検索レスポンスの `external_links` を優先**します（例: 都デジタルツインの S3 ZIP=`archive`、COPC=`copc`）。`reg_id` から自前で推測して作るのではありません。
- `external_links` が無い場合のみ公式 `…/api/v1/zipdata/{reg_id}` を出し、疎通結果を表示します（公開デモでは 404 が多い）。
- クリックした点の切り出しではなく **登録データ一式** の取得です。
- 検索API: `GET https://gsvrg.ipri.aist.go.jp/3ddb_demo/api/v1/services/ALL/features`（公式文書の `gsrt.digiarc.aist.go.jp` は301先。**ブラウザのCORS fetchは別オリジン301を追えない**ため、クライアントは最終ホストを直接指定）
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

### 内部版（差分入力のみ・公開版は残す）

公開版ボタン・公開probeはそのまま使えます。内部は **変わりうる値だけ** を実行時入力します（ホスト名・Cookie・トークンはリポジトリに書かない）。

変わりうる入力:
- `--base` / 地図の localStorage `aist3ddb.internal.base`（必須・公開URLは不可）
- `credentials`（地図: `omit`|`include`。内部でセッションCookieが要るなら `include`）
- 任意: `--features-path` / `--zipdata-path`（既定は公開と同じ `/api/v1/...`）
- 任意: `--cookie-env` / `--token-env` / `--header`（値は環境変数から。レポートに秘密は出さない）

probe（venv）:

```powershell
.\.venv\Scripts\python.exe .\scripts\probe_aist_3ddb_internal.py `
  --base https://YOUR-INTERNAL-HOST/3ddb `
  --lng 140.55 --lat 39.16 `
  --cookie-env AIST_3DDB_COOKIE `
  --probe-zipdata `
  --out .\artifacts\aist-3ddb-internal-probe.json
```

地図UI: 長押しメニュー →「内部版の接続先を設定」で base 等をこのブラウザの localStorage にだけ保存 →「内部版を検索」。クリアは設定プロンプトを空にする。
