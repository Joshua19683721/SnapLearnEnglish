# 看圖識詞 · 互動學習教室

一個用視覺 AI 幫你看圖學英文的互動學習工具！上傳照片，AI 自動標出圖片中的 10 個單字，並提供例句、音標、中文翻譯和文法拆解。

## ✨ 功能特色

### 🎯 四大學習模組
1. **實景熱點** - 照片上直接標註單字（紅色粗體 + 音標）
2. **單字圖卡** - 每個單字的完整學習卡片
3. **翻卡複習** - Flashcard 式記憶練習
4. **隨堂小測** - 互動測驗驗收學習成果

### 📚 每個單字包含
- 英文單字 + IPA 音標
- 中文翻譯（繁體中文）
- 📗 **基礎版例句**（5-8 字）
- 📘 **進階版例句**（8-12 字）
- 點擊英文直接發音（en-US TTS）

### 🤖 多模型支援
- **本地 Ollama** - 隱私安全，完全離線
  - 視覺模型：qwen3.5:4b
  - 文字模型：qwen2.5:7b
- **Groq 雲端 API** - 快速強大
  - qwen/qwen3.8-27b
  - openai/gpt-oss-120b
- **OpenRouter 免費模型** - 自動抓取 OpenRouter 上所有 `:free` 模型（含可看圖的 VL 模型）
  - API Key 只存在瀏覽器 `localStorage`，不會上傳到任何伺服器
  - 清單每 6 小時自動更新，也可按「🔄 更新模型清單」手動刷新

### 📱 手機友好
- 響應式設計，手機瀏覽器完美顯示
- 支援拍照上傳
- 大按鈕適合觸控操作

## 🌐 線上版

直接開啟：<https://joshua19683721.github.io/SnapLearnEnglish/>

## 🚀 快速開始

### 方式一：直接打開
直接雙擊 `index.html`（原檔名 `看圖識詞標註器.html`）即可在瀏覽器中打開！

### 方式二：本地 Ollama（推薦）
1. 安裝 [Ollama](https://ollama.com/)
2. 下載模型：
   ```bash
   ollama pull qwen3.5:4b
   ollama pull qwen2.5:7b
   ```
3. 設定跨域：
   ```bash
   set OLLAMA_ORIGINS=*
   ollama serve
   ```
4. 打開 `看圖識詞標註器.html`

### 方式三：Groq 雲端模型
1. 去 [Groq Console](https://console.groq.com/) 申請免費 API Key
2. 在頁面側邊欄貼上 API Key
3. 選擇 Groq 模型即可

### 方式四：OpenRouter 免費模型
1. 去 [OpenRouter](https://openrouter.ai/keys) 申請 API Key（免費）
2. 在側邊欄「OpenRouter API Key」欄位貼上（存於瀏覽器 localStorage）
3. 模型選單的「🆓 OpenRouter 免費模型」分組會列出目前所有免費模型
   - 標示 `👁 可看圖` 的可用於「視覺模型」
   - 標示 `⚠ 純文字` 的只能當「文字模型」

## 📋 使用說明

1. **上傳圖片** - 點擊「選擇圖片」或「拍照」
2. **自動辨識** - 點擊「自動辨識」按鈕
3. **學習單字** - 切換上方分頁查看不同學習模組
4. **點擊發音** - 點擊任何英文單字或例句就會朗讀

## 🎨 技術細節

- 純 HTML + CSS + JavaScript，無需建置
- 支援 Ollama /api/chat OpenAI 相容格式
- TTS 使用 Web Speech API
- 所有資料存在瀏覽器 localStorage
- 單字難度：CEFR A2-B1

## 📄 授權

MIT License - 自由使用與修改！
