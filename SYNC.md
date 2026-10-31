# 同期・編集フロー

## 公開の正本

- 静的サイト: このフォルダ（または `yuzawa_NInI_henkan/public` ステージング）
- GitHub: [`yuzawa-map-pages`](https://github.com/Yoshida088603/yuzawa-map-pages)
- **ブラウザから Pages へ直接書き込みはしない**（静的ホスト制約）

## 現地編集の流れ（推奨）

1. iPhone Safari で地図を開く（圏外でも IndexedDB にローカルメモ・写真が残る）
2. 長押し → 「ここにメモを追加」／詳細 → 編集・写真・削除
3. レイヤシート → 「ローカル変更を書き出し」で JSON バンドルを共有/保存
4. PC で venv スクリプトにより `data/memos.geojson` へマージ

```powershell
cd yuzawa-map-pages
.\.venv-scripts\Scripts\python.exe scripts\merge_memo_bundle.py .\inbox\yuzawa-memo-bundle-....json
```

5. 公開前チェック（README）のあと commit & push（機密は Access 配下）

## 競合ルール

- 同一 `id`: `client_rev` / `updated_at` の新しい方
- `local_status=deleted`: tombstone として shipped から削除
- 自動アップロードなし（未エクスポート件数を HUD / レイヤシートに表示）

## オフライン

- SW が殻 + メモ + レーザ + 森林輪郭をキャッシュ
- 航空写真・地理院・OSM タイルはオンライン必須
- 筆界 PMTiles はレイヤシートの「Wi‑Fi で保存」で任意キャッシュ

## ガード

[ACCESS.md](./ACCESS.md) を参照。
