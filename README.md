# yuzawa-map-pages

湯沢市向け Web 地図の **試験公開用**リポジトリです（GitHub Pages 想定）。

## 位置づけ

| リポジトリ | 公開設定 | 役割 |
|---|---|---|
| [`yuzawa-NInI-henkan`](https://github.com/Yoshida088603/yuzawa-NInI-henkan) | private | 開発本体・入力データ・変換スクリプト |
| **このリポジトリ** | **public** | 公開してよい静的地図だけを載せる |

private 側の `public/` が、ここに出す内容のステージング領域です。地図本体はこれから整備します。

## 試験公開 URL

GitHub Pages 有効化後:

`https://yoshida088603.github.io/yuzawa-map-pages/`

## これから載せる予定（未確定）

公開可否を確認したうえで、次のような静的ファイルを置く想定です。

- 地図 UI（HTML / CSS / JS）
- 公開してよい GeoJSON 等
- 出典・ライセンス表記

## ライセンス

コードは [MIT](./LICENSE) とします。データは出典元の利用条件に従い、公開範囲は都度確認します。
