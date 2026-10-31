# 湯沢市森林区分図 — 筆単位 PMTiles

筆界を線で見せる用途向けのベクトルタイル成果物。  
現行公開の dissolve 塗り（`shinrin.geojson`）とは別系統。MapLibre 接続は未実装。

## 入力

| 項目 | 値 |
|------|-----|
| パス | `temp/data/shinrin/shinrin.geojson` |
| CRS | EPSG:4326 |
| Feature 数 | 35,862 |
| properties | `layer_id`, `layer_name`, `color` |

再生成が必要な場合は `temp/scripts/convert_shinrin.py`（入力: `temp/10_input/湯沢市森林区分図/*.shp`、EPSG:6678）。

## tippecanoe

- バージョン: tippecanoe v2.82.0（felt/tippecanoe を Linux 上でソースビルド）
- 所要時間: **4.77 秒**（`/usr/bin/time`）
- ズーム調整: **なし**（推奨 `-Z10 -z16` のまま完了。feature の大量 drop は発生せず、低ズームでは tiny polygon の簡略化のみ）

### 最終コマンド

```bash
tippecanoe \
  -o public/data/shinrin/shinrin-parcels.pmtiles \
  -Z10 -z16 \
  -l shinrin \
  -P \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  -y layer_id -y layer_name -y color \
  temp/data/shinrin/shinrin.geojson
```

## 出力

| 項目 | 値 |
|------|-----|
| ファイル | `public/data/shinrin/shinrin-parcels.pmtiles` |
| サイズ | **10,947,327 bytes**（約 10.4 MiB） |
| layer | `shinrin` |
| minzoom / maxzoom | 10 / 16 |
| feature_count | 35,862 |
| bbox | `[140.3291561572307, 38.92547755155831, 140.6884580883866, 39.20530269331277]` |
| 保持 attributes | `layer_id`, `layer_name`, `color` |

メタデータ JSON: [`pmtiles-index.json`](./pmtiles-index.json)

### 凡例

| id | name | color |
|----|------|-------|
| kokucho | 国調 | `#0000ff` |
| mikokucho | 未国調 | `#ff0000` |
| sotei | 市森林地番図（想定図） | `#00ff00` |

## 注意

- `public/data/shinrin/shinrin.geojson`（dissolve 版・区分3ポリゴン）は削除・置換しない。
- 入力 shapefile の再配布用コピーは `public/` に置かない。
- 本 PMTiles は後続で「筆ごとの線」レイヤを載せるためのデータ成果物。GitHub Pages / MapLibre 実装・`yuzawa-map-pages` 同期はこのドキュメントの範囲外。
