# public/ ステージング

このフォルダの内容を、公開リポジトリ
[`yuzawa-map-pages`](https://github.com/Yoshida088603/yuzawa-map-pages)
へ同期する想定です。

- ここには **公開してよい静的ファイルだけ** を置く
- 入力 GeoParquet / 未確認データ / 作業用スクリプトは置かない
- 地図本体は `index.html` + `app/` + `data/` + `vendor/`

同期例（PowerShell）:

```powershell
cd ..\yuzawa-map-pages
robocopy ..\yuzawa_NInI_henkan\public . /E /XD .git
# 公開前チェック（README のチェックリスト）を確認してから commit & push
```
