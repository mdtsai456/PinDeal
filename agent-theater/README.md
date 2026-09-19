# Agent theater（評審用，不是乘客 App）

這個頁面是 user agent 把一則提案送給仲裁的房間。它不是乘客群組聊天。

在主機跑 `cd web && npm run dev`。用 Vite 印出的 **Network** URL 開 `/agent-theater/`。

例：`http://192.168.1.10:5173/agent-theater/`

不要雙擊 HTML。`file://` 不能解析 `/src/judgeMain.ts`，也不能打 `GET /api/match`。

頁面每 2 秒讀現有 `GET /api/match`。團檔變了，房間跟著變。字串沒變則不重畫。

- 等待中：`joins` 轉成字母 A／B／C／D。不上 username。`riders` 此時是空陣列。
- 白泡：user agent 送出的 pitch／分數。匿名，只寫 Agent A／B／C／D。
- 紫塊 **Arbiter mind**：仲裁心智。在算跳表、拆帳、多數、牆踢。不是一個叫 R 的人在群裡說話。
- 上車序依 `sharePlan` 走廊投影。不是 join 序。
- 乘客 App 只看得到自己那位 agent 的英文劇場。沒有這個房間的入口。

## 價錢怎麼來

1. 每人獨乘：新竹跳表。
2. 共乘總額：`0.72 × 獨乘和`。
3. 按獨乘比拆。最後一人吃 residual。
4. v2 沿 axis／give 微調。2 人要 2 票。3 人要 2 票。4 人要 3 票。

已知限制：第 3、第 4 人加入已成交團會開新團。評審頁跟 `current.json`，多半是 2 人房。
