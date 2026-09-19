# 同乘 · 梅竹黑客松 demo

此專案是手機版 Web。功能是把不同起訖點組成可分帳的共乘。沒有 Google Maps 金鑰時，路線用 mock。沒有 OpenRouter key 時，解析用本地規則。

```bash
cd web
npm install
npm run dev
```

用瀏覽器開啟終端機顯示的 Local URL。桌面瀏覽器會顯示手機框。手機可直接開啟。

可選：在 `web/.env` 放入 `OPENROUTER_API_KEY`。不要把 key 寫進文件或 git。有 key 時，第 2 步會呼叫 OpenRouter。沒有 key 時，用本地結構化。
