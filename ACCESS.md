# 簡易アクセスガード（Cloudflare Access）

自分＋必要なら同僚だけが地図（特に地点メモ・写真）を見られるようにする手順です。
GitHub Pages 単体では Basic 認証相当はできないため、**Cloudflare Access** を推奨します。

## 方針

- 強度目標: URL を知っていても、許可メール以外は中に入れない
- 過剰な本格 IdP / 組織 SSO は使わない（メール OTP または Google）
- 機密（詳細メモ・現地写真）は **Access 配下のデプロイにのみ**含める
- 現行の公開 GitHub Pages は、公開してよいレイヤ用に残すか、最終的に Access 側へ一本化する

## 推奨構成: Cloudflare Pages + Access

1. Cloudflare アカウントを用意する
2. 私有または公開リポジトリ `yuzawa-map-pages` を **Cloudflare Pages** に接続しデプロイする  
   - ビルド不要の静的サイト（出力ディレクトリ = リポジトリルート）
3. Zero Trust → Access → Applications で Pages のホストを保護
4. Policy: Include → Emails（自分と同僚）  
   Identity provider: One-time PIN（メール）または Google
5. 動作確認: 未ログインで遮断、許可メールで OTP 後に地図表示
6. [`app/config.js`](app/config.js) の `PUBLIC_URL` と QR（`app/qr-public.png`）を Access 後 URL に更新

## 代替: カスタムドメインで GitHub Pages をプロキシ

1. Pages にカスタムドメインを設定
2. そのドメインの DNS を Cloudflare にする
3. Access でそのホストを保護（上記と同様）

## 運用チェック

- [ ] 未認証で `data/memos.geojson` や写真に直接届かない
- [ ] 公開してよいレーザ／森林データと、ガード内データの置き場を分けた
- [ ] `merge_memo_bundle.py --photos` で写真をリポに入れた場合、**Access 配下にだけ** push した
- [ ] 同僚追加・削除は Access Policy のメール一覧だけ触る

## やらないこと

- URL 秘匿だけ（不十分）
- アプリ JS 内の共有シークレットで「暗号化したふり」
- スマホに GitHub PAT を置いて直 push
