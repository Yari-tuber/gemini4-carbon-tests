# 《Google Antigravity — 让创造，脱离引力》导演阐述与分镜脚本（Apple 产品发布会风格）

## 1. 核心立意与风格定位（Apple Launch Film Minimalist 2K 60fps Aesthetic）
本片是为 **Google Antigravity** 打造的 **60.00 秒（2K 2560×1440 @ 60 fps，3600 帧，120 BPM / 30 小节）** 苹果发布会级（Cupertino Minimalist Keynote）旗舰产品宣传片。全片遵循极致克制、简约的苹果设计语言，剔除一切细碎装饰小字、英文副标、悬浮状态标签与画面烧录字幕（字幕独立输出为 `.srt`），仅以单行高对比大标题配合从 `antigravity.google` 官方搜集的真实品牌矢量标识、高清实机界面与四段真实产品演示画面呈现：

- **双色摄影棚光影体系（Porcelain Daylight & Space Black Pro）**：
  - **白昼陶瓷摄影棚（`#FFFFFF` / `#F5F5F7`）**：大面积留白的苹果浅色画布，仅保留单行 `#1D1D1F` 凝练主标题、多层超柔环境接触阴影，以及 Google Antigravity 官方标志性的四色柔和光谱呼吸光晕（`#3186FF`、`#34A853`、`#FBBC05`、`#EA4335`）。
  - **深空黑专业摄影棚（`#000000` / `#090D18`）**：全片正中点（`29.50 s`）经历 **1.00 秒绝对静默与纯几何虹膜翻转** 后切入深空黑专业模式，呈现架构制品 `Artifacts`、内置 `Browser Agent` 实机操控浏览器验证以及 `agy CLI`、`Python SDK` 与插件市场。
- **2K 60fps 苹果弹簧物理与 128 切片 2.5D 视网膜悬浮窗**：所有窗口与卡片均采用高阻尼苹果弹簧曲线（`ω=14.0, ζ=0.84`）与原生 2K 离屏缓冲透视投影，带来丝滑的 60 帧动态质感。
- **极简 Apple Bento Grid 收束**：高潮段落（`46.50–53.50 s`）回归 `#F5F5F7` 浅色画布，六张大留白圆角 Bento 卡片仅保留单行精炼标题与官方实机画面预览，随后化入纯白终帧官方标识定格（`53.50–60.00 s`）。

---

## 2. 三种候选叙事结构与抉择
1. **结构 A：纯浅色单镜到底功能巡礼** —— 全程停留在白色背景平移展示窗口，缺少苹果大片中段“Pro 深色模式反转”的戏剧张力与节奏呼吸。
2. **结构 B：纯深色硬件概念渲染** —— 偏重暗黑光效，无法展现 Google Antigravity 官方极具辨识度的浅色光谱边框 UI 与清爽阅读质感。
3. **结构 C（最终选用）：白昼启航 → 智能体并行升空 → 静默反转深空黑实机闭环 → Apple 六宫格 Bento 总览 → 纯白品牌定格** —— 完美融合苹果软件发布会的清爽呼吸感、Pro 级工程深度与 Bento 总结记忆点。

---

## 3. 八镜精确分镜与真实素材映射表（120 BPM · 1 拍 = 0.50 s · 1 小节 = 2.00 s）

| 镜头 | 时间 (s) | 小节 | 视觉与运镜设计（含官方真实素材映射） | 旁白与字幕 |
|---|---|---|---|---|
| **S1 · 粒子升空与品牌揭示** | `0.00–6.50` | 1–3.25 | 纯白画布上，官方 `logo_blue.mp4` 数百颗微粒轻盈逆重力升空，无缝汇聚为官方彩色矢量拱门 `icon-color.svg` 与 `lockup-light.svg`（`Google Antigravity`），下方浮现苹果紧凑排版副标题 `Experience liftoff.` | **L1** (`1.00s`)：认识 Google Antigravity，为智能体时代重构的开发平台。 |
| **S2 · 一句意图，全局启动** | `6.50–13.50` | 3.25–6.75 | `#F5F5F7` 摄影棚中，2.5D 悬浮窗呈现官方 `new-chat.png`（`Gemini` · `New Worktree`）及彩色光谱边框 `ide-agent.jpg`。平滑光标推镜输入自然语言指令并点击蓝色发送键。 | **L2** (`7.00s`)：只需一句自然语言，你的意图即刻化为全局行动。 |
| **S3 · Antigravity IDE 行云流水** | `13.50–21.50` | 6.75–10.75 | 镜头轻盈横移并微距推入官方实机视频 `editor.mp4`（`Implementation plan` 与 `LoginButton.tsx` 实时自动补全、四色流光边框呼吸），侧边浮现苹果毛玻璃特性胶囊：`Tab 超级补全` · `Tab 脉络跳转` · `⌘I 行内重构`。 | **L3** (`14.00s`)：在 Antigravity IDE 中，Tab 键预判下一处脉络，让编码行云流水。 |
| **S4 · Agent Manager 并行编排** | `21.50–29.50` | 10.75–14.75 | 镜头拉远展现多窗口协同：主窗口为官方 `subagents.png`（三个研究子智能体 `Database` / `API` / `Bootstrap Researcher` 并行运转），右侧悬浮官方 `scheduled.png`（`Scheduled Tasks` 定时任务全天值守）。 | **L4** (`22.00s`)：多路子智能体跨工作区并行探索，定时任务在后台全天值守。 |
| **静默反转 · Pro 深空黑** | `29.50–30.50` | 14.75–15.25 | **1.00 秒绝对数字静音（`-∞ dBFS`）**。画面中央虹膜光圈扩张为 `#000000` 深空黑摄影棚，钛金属高光掠过窗口边缘。 | *（呼吸留白，无台词）* |
| **S5 · Artifacts 与浏览器实机自检** | `30.50–39.00` | 15.25–19.5 | 深空黑双层视网膜窗：左侧展示官方 `artifacts-app.png`（架构图、`Implementation Plan` 与 `Walkthrough` 可信交付）；右侧推入官方实机视频 `flight_tracker.mp4`（内置浏览器智能体泛起蓝光边框，自动输入 `AA100` 并校验 `JFK → LHR` 登机牌）。 | **L5** (`31.00s`)：从架构计划到走查报告，更有浏览器智能体亲自启动页面、实机验证。 |
| **S6 · CLI、Python SDK 与开放生态** | `39.00–46.50` | 19.5–23.25 | 左侧悬浮裁切纯净的官方实机终端视频 `cli_prompt.mp4`（像素彩虹拱门 `Antigravity CLI` 实时生成项目计划）；右侧叠放 `pip install google-antigravity` 代码卡与官方 `marketplace.png`、`skills.jpg`（插件市场与 `MCP` 生态）。 | **L6** (`39.40s`)：从命令行工具、Python SDK，到开放的插件市场与 MCP 生态。 |
| **S7 · Apple 六宫格 Bento 总览** | `46.50–53.50` | 23.25–26.75 | 节拍切回 `#F5F5F7` 浅色摄影棚！6 张圆角 Bento 卡片随八分音符依次弹入锁定（`Agent Manager`、`Antigravity IDE`、`Browser Agent`、`Artifacts`、`agy CLI & SDK`、`Ecosystem`），构成经典苹果发布会总结画面。 | **L7** (`47.10s`)：Google Antigravity。当工程脱离引力，让创造自由升空。 |
| **S8 · 纯白品牌终帧定格** | `53.50–60.00` | 26.75–30 | Bento 网格柔和退场化入 `#FFFFFF` 纯白画布，中央官方彩色拱门 `icon-color.svg` 与 `Google Antigravity`（`lockup-light.svg`）优雅落定，下方浮现 `让创造，脱离引力。` 与 `antigravity.google · macOS · Windows · Linux`，大调九和弦自然余韵收束。 | *（音乐余韵与品牌定格）* |

---

## 4. 原创配乐与声音设计（48 kHz 立体声，目标响度 −14 LUFS）
- **配器（CC0 真实乐器采样 VSCO 2 CE + VCSL + Karoryfer）**：
  - 温暖立式毡音钢琴 `upright`（Fmaj9 – G6 – Am9 – Cmaj9 苹果发布会温暖人文底色）
  - 竖琴泛音 `harp`、颤音琴 `vibraphone` / 弓奏颤音琴 `vibraphone_bowed`、钟琴 `glockenspiel`、手钟 `hand_chimes`
  - 室内弦乐拨奏 `violins_pizz` / `cellos_pizz` 与温暖长音弦乐垫底 `violins` / `cellos`
  - 爵士拨弦贝斯 `jazz_bass` + 纯净谐波低音（Sub-bass），配以精致现代律动（`hihat:closed`、`snare2:taps`、`claps:solo`、`shaker`）
- **拟音（Foley）与混音**：光标微距推进气流声、清脆触控板点按、键盘柔和敲击、Bento 卡片六连弹玻璃磁吸卡扣声；`[29.50, 30.50]` 严格数字静音；人声期间背景音乐智能闪避 `-9.5 dB`，确保每个中英文词汇清晰透亮。
