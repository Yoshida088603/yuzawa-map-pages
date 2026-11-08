# GeoTIFF / オルソ画像オーバーレイ

A-Survey 等の CAD 側では GeoTIFF をそのまま、または [geotiff_processor](https://github.com/Yoshida088603/geotiff_processor) で JPEG + ワールドファイル化して使います。Web 地図では **JPEG + 四隅座標** を MapLibre `image` ソースとして重ねます。

## 追加手順

1. GeoTIFF を `geotiff_processor.exe` にドラッグし、同ディレクトリに `.jpg` / `.csv`（四隅）を生成
2. `.jpg` をこのフォルダへコピー（例: `data/raster/yuzawa-ortho.jpg`）
3. `index.json` の `layers` にエントリを追加

```json
{
  "layers": [
    {
      "id": "yuzawa-ortho",
      "name": "湯沢オルソ",
      "image": "data/raster/yuzawa-ortho.jpg",
      "defaultOn": false,
      "opacity": 0.85,
      "planeCorners": {
        "upperLeft": [-105400.0, -35100.0],
        "upperRight": [-105300.0, -35100.0],
        "lowerRight": [-105300.0, -35200.0],
        "lowerLeft": [-105400.0, -35200.0]
      }
    }
  ]
}
```

`planeCorners` は第10系の X（北）, Y（東）メートル。WGS84 四隅が分かる場合は `coordinates: [[lng,lat], ...]`（左上→右上→右下→左下）でも可。

4. `data/manifest.json` の `version` を更新してキャッシュを更新
