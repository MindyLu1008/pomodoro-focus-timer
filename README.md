# 蕃茄時光 Pomodoro Focus Timer

一個使用原生 HTML、CSS 與 JavaScript 製作的可自訂番茄鐘。無需安裝套件，可直接部署到 GitHub Pages。

## 功能

- 預設 25 分鐘專注、5 分鐘短休息
- 每完成 4 個番茄鐘，進入 15 分鐘長休息
- 可調整三種時間、每輪番茄數，以及是否自動開始下一階段
- 桌面通知、柔和提示音與頁面訊息
- 顯示本輪與今日完成進度
- 設定及今日統計保存在瀏覽器
- 支援手機與桌面版面、降低動態效果偏好

## 本機使用

直接開啟 `index.html` 即可。桌面通知通常需要 HTTPS 或 localhost，因此也可以在資料夾內執行：

```bash
python3 -m http.server 8080
```

然後開啟 `http://localhost:8080`。

## 部署到 GitHub Pages

在 repository 的 **Settings → Pages**，將來源設為 **Deploy from a branch**，選擇 `main` 與 `/ (root)` 後儲存。
